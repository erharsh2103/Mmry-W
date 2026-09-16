/*
 * Safe zone, position reports and SOS.
 *
 * The device reports fixes; the geofence decision is made here so every
 * caregiver sees the same state and history. Coordinates are encrypted before
 * they reach the database.
 */
import { withTransaction } from "../config/postgres.js";
import type { AlertContact, LocationEventKind, SafeZoneRecord, SafetyState } from "../models/safety.js";
import { peopleRepository } from "../repositories/routine.repository.js";
import { alertContactsRepository, locationEventsRepository, locationNotificationsRepository, safeZonesRepository } from "../repositories/safety.repository.js";
import { decrypt, decryptJson, encrypt, encryptJson } from "../utils/crypto.js";
import { bearingDeg, distanceM, isOutside, type LatLon } from "../utils/geo.js";
import { badRequest, notFound } from "../utils/httpError.js";

const EVENT_HISTORY = 25;
const LOCATION_UPDATE_INTERVAL_MS = 5 * 60_000;

function indianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(national)) throw badRequest("Use a valid Indian mobile number");
  return `+91${national}`;
}

async function buildState(patientId: string, zone: SafeZoneRecord): Promise<SafetyState> {
  const home = decryptJson<LatLon>(zone.homeEnc);
  const fix = decryptJson<LatLon>(zone.lastFixEnc);
  const distance = home && fix ? distanceM(fix, home) : null;
  const events = await locationEventsRepository.recent(patientId, EVENT_HISTORY);
  return {
    zone: { home, radiusM: zone.radiusM, armed: zone.armed, trackingEnabled: zone.trackingEnabled },
    lastFix: fix && zone.lastFixAt ? { ...fix, accuracyM: zone.lastFixAccuracyM ?? 0, at: zone.lastFixAt.toISOString() } : null,
    distanceM: distance === null ? null : Math.round(distance),
    // bearing from home to the patient, which is how the radar places the dot
    bearingDeg: home && fix ? Math.round(bearingDeg(home, fix)) : null,
    outside: distance !== null && zone.armed && distance > zone.radiusM,
    events: events.map((e) => ({ id: e.id, kind: e.kind, at: e.occurredAt.toISOString(), distanceM: e.distanceM })),
  };
}

async function requireZone(patientId: string): Promise<SafeZoneRecord> {
  const zone = await safeZonesRepository.get(patientId);
  if (!zone) throw notFound("Safe zone not found");
  return zone;
}

export const safetyService = {
  async state(patientId: string): Promise<SafetyState> {
    return buildState(patientId, await requireZone(patientId));
  },

  async updateZone(
    patientId: string,
    changes: { radiusM?: number; armed?: boolean; trackingEnabled?: boolean },
  ): Promise<SafetyState> {
    await withTransaction((db) => safeZonesRepository.update(db, patientId, changes));
    return this.state(patientId);
  },

  /* Home becomes the last received position, or a pinned place. History restarts. */
  async setHome(patientId: string, source: { kind: "lastFix" } | { kind: "place"; personId: string }): Promise<SafetyState> {
    const zone = await requireZone(patientId);
    let homeEnc: string | null | undefined;
    if (source.kind === "lastFix") {
      homeEnc = zone.lastFixEnc;
      if (!homeEnc) throw badRequest("No position has been received yet");
    } else {
      homeEnc = await peopleRepository.findLocationEnc(patientId, source.personId);
      if (homeEnc === undefined) throw notFound("Place not found");
      if (!homeEnc) throw badRequest("That place has no saved position");
    }
    await withTransaction(async (db) => {
      await safeZonesRepository.update(db, patientId, { homeEnc });
      await locationEventsRepository.clearCrossings(db, patientId);
    });
    return this.state(patientId);
  },

  async reportFix(patientId: string, fix: LatLon & { accuracyM: number }): Promise<{ transition: LocationEventKind | null; state: SafetyState }> {
    const transition = await withTransaction(async (db) => {
      const zone = await safeZonesRepository.getForUpdate(db, patientId);
      if (!zone) throw notFound("Safe zone not found");
      const position = { lat: fix.lat, lon: fix.lon };
      const positionEnc = encryptJson(position);
      await safeZonesRepository.recordFix(db, patientId, positionEnc, Math.round(fix.accuracyM));

      const home = decryptJson<LatLon>(zone.homeEnc);
      if (!zone.armed || !home) return null;
      const distance = distanceM(position, home);
      const wasOutside = (await locationEventsRepository.lastCrossing(db, patientId)) === "out";
      const outside = isOutside(distance, zone.radiusM, fix.accuracyM, wasOutside);
      const contacts = await alertContactsRepository.listEnabled(db, patientId);
      if (outside !== wasOutside) {
        const kind: LocationEventKind = outside ? "out" : "in";
        const event = await locationEventsRepository.insert(db, patientId, { kind, distanceM: Math.round(distance), positionEnc });
        for (const contact of contacts) {
          await locationNotificationsRepository.enqueue(db, {
            patientId,
            eventId: event.id,
            contactId: contact.id,
            kind: outside ? "geofence_out" : "geofence_in",
            recipientEnc: contact.phone_enc,
            locationEnc: positionEnc,
          });
        }
        if (contacts.length) await safeZonesRepository.markLocationAlert(db, patientId);
        return kind;
      }

      if (outside && contacts.length && (!zone.lastLocationAlertAt || Date.now() - zone.lastLocationAlertAt.getTime() >= LOCATION_UPDATE_INTERVAL_MS)) {
        for (const contact of contacts) {
          await locationNotificationsRepository.enqueue(db, {
            patientId,
            eventId: null,
            contactId: contact.id,
            kind: "location_update",
            recipientEnc: contact.phone_enc,
            locationEnc: positionEnc,
          });
        }
        await safeZonesRepository.markLocationAlert(db, patientId);
      }
      return null;
    });
    return { transition, state: await this.state(patientId) };
  },

  async contacts(patientId: string): Promise<AlertContact[]> {
    return (await alertContactsRepository.list(patientId)).map((contact) => ({
      id: contact.id,
      label: contact.label,
      phone: decrypt(contact.phone_enc),
      enabled: contact.enabled,
    }));
  },

  async addContact(patientId: string, label: string, phone: string): Promise<AlertContact> {
    const normalized = indianMobile(phone);
    const contact = await alertContactsRepository.add(patientId, label, encrypt(normalized));
    return { id: contact.id, label: contact.label, phone: normalized, enabled: contact.enabled };
  },

  async removeContact(patientId: string, contactId: string): Promise<void> {
    if (!(await alertContactsRepository.remove(patientId, contactId))) throw notFound("Alert contact not found");
  },

  async recordSos(patientId: string): Promise<SafetyState> {
    const zone = await requireZone(patientId);
    await withTransaction((db) =>
      locationEventsRepository.insert(db, patientId, { kind: "sos", distanceM: null, positionEnc: zone.lastFixEnc }),
    );
    return buildState(patientId, zone);
  },
};
