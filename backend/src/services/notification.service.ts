import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { decrypt, decryptJson } from "../utils/crypto.js";
import type { LatLon } from "../utils/geo.js";
import { locationNotificationsRepository } from "../repositories/safety.repository.js";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;

function twilioConfigured(): boolean {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

function messageFor(kind: string, patientName: string, location: LatLon | null): string {
  const map = location ? ` https://maps.google.com/?q=${location.lat.toFixed(6)},${location.lon.toFixed(6)}` : "";
  if (kind === "geofence_out") return `Mmry alert: ${patientName} has left the safe zone. Live location:${map}`;
  if (kind === "geofence_in") return `Mmry update: ${patientName} has returned to the safe zone.${map}`;
  return `Mmry update: ${patientName} is still outside the safe zone. Latest location:${map}`;
}

async function sendTwilio(to: string, body: string): Promise<void> {
  const path = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID!)}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body });
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(path, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Twilio returned ${response.status}`);
}

export async function deliverLocationNotifications(): Promise<number> {
  if (!twilioConfigured()) return 0;
  const rows = await locationNotificationsRepository.claimPending(BATCH_SIZE);
  let delivered = 0;
  for (const row of rows) {
    try {
      const location = row.locationEnc ? decryptJson<LatLon>(row.locationEnc) : null;
      await sendTwilio(decrypt(row.recipientEnc), messageFor(row.kind, row.patientName, location));
      await locationNotificationsRepository.markSent(row.id);
      delivered += 1;
    } catch (err) {
      await locationNotificationsRepository.markFailed(row.id, (err as Error).message.slice(0, 300), row.attempts >= MAX_ATTEMPTS);
      logger.warn("location notification delivery failed", { notificationId: row.id, attempts: row.attempts });
    }
  }
  return delivered;
}

export function notificationDeliveryEnabled(): boolean {
  return twilioConfigured();
}
