import { pool, type Queryable } from "../config/postgres.js";
import type { LocationEventKind, LocationEventRecord, SafeZoneRecord } from "../models/safety.js";

interface ZoneRow {
  patient_id: string;
  home_enc: string | null;
  radius_m: number;
  armed: boolean;
  tracking_enabled: boolean;
  last_fix_enc: string | null;
  last_fix_accuracy_m: number | null;
  last_fix_at: Date | null;
}

const toZone = (r: ZoneRow): SafeZoneRecord => ({
  patientId: r.patient_id,
  homeEnc: r.home_enc,
  radiusM: r.radius_m,
  armed: r.armed,
  trackingEnabled: r.tracking_enabled,
  lastFixEnc: r.last_fix_enc,
  lastFixAccuracyM: r.last_fix_accuracy_m,
  lastFixAt: r.last_fix_at,
});

const ZONE_COLUMNS = "patient_id, home_enc, radius_m, armed, tracking_enabled, last_fix_enc, last_fix_accuracy_m, last_fix_at";

export const safeZonesRepository = {
  async createDefault(db: Queryable, patientId: string): Promise<void> {
    await db.query("INSERT INTO safe_zones (patient_id) VALUES ($1) ON CONFLICT DO NOTHING", [patientId]);
  },

  /* Locking read, so concurrent fixes evaluate the geofence one at a time. */
  async getForUpdate(db: Queryable, patientId: string): Promise<SafeZoneRecord | null> {
    const { rows } = await db.query<ZoneRow>(`SELECT ${ZONE_COLUMNS} FROM safe_zones WHERE patient_id = $1 FOR UPDATE`, [patientId]);
    return rows[0] ? toZone(rows[0]) : null;
  },

  async get(patientId: string): Promise<SafeZoneRecord | null> {
    const { rows } = await pool.query<ZoneRow>(`SELECT ${ZONE_COLUMNS} FROM safe_zones WHERE patient_id = $1`, [patientId]);
    return rows[0] ? toZone(rows[0]) : null;
  },

  async update(
    db: Queryable,
    patientId: string,
    changes: Partial<Pick<SafeZoneRecord, "homeEnc" | "radiusM" | "armed" | "trackingEnabled">>,
  ): Promise<void> {
    const map = { homeEnc: "home_enc", radiusM: "radius_m", armed: "armed", trackingEnabled: "tracking_enabled" } as const;
    const entries = Object.entries(changes).filter(([, v]) => v !== undefined) as [keyof typeof map, unknown][];
    if (!entries.length) return;
    const sets = entries.map(([k], i) => `${map[k]} = $${i + 2}`);
    await db.query(`UPDATE safe_zones SET ${sets.join(", ")} WHERE patient_id = $1`, [patientId, ...entries.map(([, v]) => v)]);
  },

  async recordFix(db: Queryable, patientId: string, fixEnc: string, accuracyM: number): Promise<void> {
    await db.query(
      "UPDATE safe_zones SET last_fix_enc = $2, last_fix_accuracy_m = $3, last_fix_at = now() WHERE patient_id = $1",
      [patientId, fixEnc, accuracyM],
    );
  },
};

interface EventRow {
  id: string;
  kind: LocationEventKind;
  occurred_at: Date;
  distance_m: number | null;
  position_enc: string | null;
}

const toEvent = (r: EventRow): LocationEventRecord => ({
  id: r.id,
  kind: r.kind,
  occurredAt: r.occurred_at,
  distanceM: r.distance_m,
  positionEnc: r.position_enc,
});

export const locationEventsRepository = {
  async insert(
    db: Queryable,
    patientId: string,
    e: { kind: LocationEventKind; distanceM: number | null; positionEnc: string | null },
  ): Promise<LocationEventRecord> {
    const { rows } = await db.query<EventRow>(
      `INSERT INTO location_events (patient_id, kind, distance_m, position_enc) VALUES ($1, $2, $3, $4)
       RETURNING id, kind, occurred_at, distance_m, position_enc`,
      [patientId, e.kind, e.distanceM, e.positionEnc],
    );
    return toEvent(rows[0]!);
  },

  /* Latest geofence crossing (ignores SOS), which decides the hysteresis side. */
  async lastCrossing(db: Queryable, patientId: string): Promise<LocationEventKind | null> {
    const { rows } = await db.query<{ kind: LocationEventKind }>(
      `SELECT kind FROM location_events WHERE patient_id = $1 AND kind IN ('out', 'in')
        ORDER BY occurred_at DESC LIMIT 1`,
      [patientId],
    );
    return rows[0]?.kind ?? null;
  },

  async recent(patientId: string, limit: number): Promise<LocationEventRecord[]> {
    const { rows } = await pool.query<EventRow>(
      `SELECT id, kind, occurred_at, distance_m, position_enc FROM location_events
        WHERE patient_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [patientId, limit],
    );
    return rows.map(toEvent);
  },

  /* Moving home starts a fresh history, as the original app did. */
  async clearCrossings(db: Queryable, patientId: string): Promise<void> {
    await db.query("DELETE FROM location_events WHERE patient_id = $1 AND kind IN ('out', 'in')", [patientId]);
  },
};
