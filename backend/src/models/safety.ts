import type { LatLon } from "../utils/geo.js";

export type LocationEventKind = "out" | "in" | "sos";
export type LocationNotificationKind = "geofence_out" | "location_update" | "geofence_in";

export interface SafeZoneRecord {
  patientId: string;
  homeEnc: string | null;
  radiusM: number;
  armed: boolean;
  trackingEnabled: boolean;
  lastFixEnc: string | null;
  lastFixAccuracyM: number | null;
  lastFixAt: Date | null;
  lastLocationAlertAt: Date | null;
}

export interface AlertContact {
  id: string;
  label: string;
  phone: string;
  enabled: boolean;
}

export interface LocationEventRecord {
  id: string;
  kind: LocationEventKind;
  occurredAt: Date;
  distanceM: number | null;
  positionEnc: string | null;
}

/* Decrypted, computed view for the caregiver screen. */
export interface SafetyState {
  zone: {
    home: LatLon | null;
    radiusM: number;
    armed: boolean;
    trackingEnabled: boolean;
  };
  lastFix: (LatLon & { accuracyM: number; at: string }) | null;
  /* derived from home + last fix, so the client does no geodesy */
  distanceM: number | null;
  bearingDeg: number | null;
  outside: boolean;
  events: { id: string; kind: LocationEventKind; at: string; distanceM: number | null }[];
}

export const RADII = [200, 500, 1000, 2000] as const;
