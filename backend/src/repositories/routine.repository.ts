import { pool, type Queryable } from "../config/postgres.js";
import type { Person, Task } from "../models/routine.js";

interface TaskRow {
  id: string;
  label_key: string | null;
  label: string | null;
  time_key: string | null;
  hour: number;
  icon: string;
  sort_order: number;
  done: boolean;
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  labelKey: r.label_key,
  label: r.label,
  timeKey: r.time_key,
  hour: r.hour,
  icon: r.icon,
  sortOrder: r.sort_order,
  done: r.done,
});

export const tasksRepository = {
  /* Copy the reference routine to a new patient. */
  async createFromTemplates(db: Queryable, patientId: string): Promise<void> {
    await db.query(
      `INSERT INTO tasks (patient_id, label_key, time_key, hour, icon, sort_order)
       SELECT $1, label_key, time_key, hour, icon, sort_order FROM task_templates ORDER BY sort_order`,
      [patientId],
    );
  },

  /* Active tasks with their completion state for one local calendar day. */
  async listForDay(patientId: string, day: string): Promise<Task[]> {
    const { rows } = await pool.query<TaskRow>(
      `SELECT t.id, t.label_key, t.label, t.time_key, t.hour, t.icon, t.sort_order,
              (tc.task_id IS NOT NULL) AS done
         FROM tasks t
         LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completed_on = $2
        WHERE t.patient_id = $1 AND t.is_active
        ORDER BY t.hour, t.sort_order`,
      [patientId, day],
    );
    return rows.map(toTask);
  },

  /* A reminder the patient added themselves: free text, no i18n key, no fixed time phrase. */
  async create(patientId: string, input: { label: string; hour: number; icon: string }): Promise<Task> {
    const { rows } = await pool.query<TaskRow>(
      `INSERT INTO tasks (patient_id, label, hour, icon, sort_order)
       VALUES ($1, $2, $3, $4,
               LEAST(COALESCE((SELECT max(sort_order) + 1 FROM tasks WHERE patient_id = $1), 1), 32767))
       RETURNING id, label_key, label, time_key, hour, icon, sort_order, false AS done`,
      [patientId, input.label, input.hour, input.icon],
    );
    return toTask(rows[0]!);
  },

  async belongsTo(taskId: string, patientId: string): Promise<boolean> {
    const { rowCount } = await pool.query("SELECT 1 FROM tasks WHERE id = $1 AND patient_id = $2 AND is_active", [taskId, patientId]);
    return (rowCount ?? 0) > 0;
  },

  async setDone(taskId: string, day: string, done: boolean, userId: string): Promise<void> {
    if (done) {
      await pool.query(
        `INSERT INTO task_completions (task_id, completed_on, completed_by) VALUES ($1, $2, $3)
         ON CONFLICT (task_id, completed_on) DO NOTHING`,
        [taskId, day, userId],
      );
    } else {
      await pool.query("DELETE FROM task_completions WHERE task_id = $1 AND completed_on = $2", [taskId, day]);
    }
  },

  /* A finished game ticks off the day's activity task, as the original app did. */
  async completeByLabelKey(db: Queryable, patientId: string, labelKey: string, day: string, userId: string): Promise<void> {
    await db.query(
      `INSERT INTO task_completions (task_id, completed_on, completed_by)
       SELECT id, $3, $4 FROM tasks WHERE patient_id = $1 AND label_key = $2 AND is_active
       ON CONFLICT (task_id, completed_on) DO NOTHING`,
      [patientId, labelKey, day, userId],
    );
  },
};

interface PersonRow {
  id: string;
  name_key: string | null;
  name: string | null;
  relation_key: string | null;
  relation: string | null;
  note_key: string | null;
  note: string | null;
  emoji: string;
  is_place: boolean;
  location_enc: string | null;
  located_at: Date | null;
}

export type PersonRecord = Omit<Person, "location" | "locatedAt"> & { locationEnc: string | null; locatedAt: Date | null };

const toPerson = (r: PersonRow): PersonRecord => ({
  id: r.id,
  nameKey: r.name_key,
  name: r.name,
  relationKey: r.relation_key,
  relation: r.relation,
  noteKey: r.note_key,
  note: r.note,
  emoji: r.emoji,
  isPlace: r.is_place,
  locationEnc: r.location_enc,
  locatedAt: r.located_at,
});

const PERSON_COLUMNS = "id, name_key, name, relation_key, relation, note_key, note, emoji, is_place, location_enc, located_at";

export const peopleRepository = {
  async createFromTemplates(db: Queryable, patientId: string): Promise<void> {
    await db.query(
      `INSERT INTO people (patient_id, name_key, relation_key, note_key, emoji, is_place, sort_order)
       SELECT $1, name_key, relation_key, note_key, emoji, is_place, sort_order FROM person_templates ORDER BY sort_order`,
      [patientId],
    );
  },

  async list(patientId: string): Promise<PersonRecord[]> {
    const { rows } = await pool.query<PersonRow>(
      `SELECT ${PERSON_COLUMNS} FROM people WHERE patient_id = $1 ORDER BY sort_order, created_at`,
      [patientId],
    );
    return rows.map(toPerson);
  },

  async create(
    patientId: string,
    input: { name: string; relation: string | null; note: string | null; emoji: string; isPlace: boolean },
  ): Promise<PersonRecord> {
    const { rows } = await pool.query<PersonRow>(
      `INSERT INTO people (patient_id, name, relation, note, emoji, is_place, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT max(sort_order) + 1 FROM people WHERE patient_id = $1), 1))
       RETURNING ${PERSON_COLUMNS}`,
      [patientId, input.name, input.relation, input.note, input.emoji, input.isPlace],
    );
    return toPerson(rows[0]!);
  },

  async delete(patientId: string, personId: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM people WHERE id = $1 AND patient_id = $2", [personId, patientId]);
    return (rowCount ?? 0) > 0;
  },

  async setLocation(patientId: string, personId: string, locationEnc: string | null): Promise<PersonRecord | null> {
    const { rows } = await pool.query<PersonRow>(
      `UPDATE people SET location_enc = $3, located_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END
        WHERE id = $1 AND patient_id = $2 RETURNING ${PERSON_COLUMNS}`,
      [personId, patientId, locationEnc],
    );
    return rows[0] ? toPerson(rows[0]) : null;
  },

  async findLocationEnc(patientId: string, personId: string): Promise<string | null | undefined> {
    const { rows } = await pool.query<{ location_enc: string | null }>(
      "SELECT location_enc FROM people WHERE id = $1 AND patient_id = $2",
      [personId, patientId],
    );
    return rows[0] ? rows[0].location_enc : undefined;
  },
};
