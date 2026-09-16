/*
 * Safe zone, position reports and SOS.
 *
 * The device reports fixes; the geofence decision is made here so every
 * caregiver sees the same state and history. Coordinates are encrypted before
 * they reach the database.
 */
import { withTransaction } from "../config/postgres.js";
import type { LocationEventKind, SafeZoneRecord, SafetyState } from "../models/safety.js";
import { peopleRepository } from "../repositories/routine.repository.js";
import { locationEventsRepository, safeZonesRepository } from "../repositories/safety.repository.js";
import { decryptJson, encryptJson } from "../utils/crypto.js";
import { bearingDeg, distanceM, isOutside, type LatLon } from "../utils/geo.js";
import { badRequest, notFound } from "../utils/httpError.js";

const EVENT_HISTORY = 25;

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
      if (outside === wasOutside) return null;
      const kind: LocationEventKind = outside ? "out" : "in";
      await locationEventsRepository.insert(db, patientId, { kind, distanceM: Math.round(distance), positionEnc });
      return kind;
    });
    return { transition, state: await this.state(patientId) };
  },

  async recordSos(patientId: string): Promise<SafetyState> {
    const zone = await requireZone(patientId);
    await withTransaction((db) =>
      locationEventsRepository.insert(db, patientId, { kind: "sos", distanceM: null, positionEnc: zone.lastFixEnc }),
    );
    return buildState(patientId, zone);
  },
};
