/*
 * PostgreSQL setup, run with the OWNER account (never by the running API):
 *
 *   1. migrations/  versioned, applied once each, in order, recorded in schema_migrations
 *   2. schema/      repeatable (functions, triggers, views), re-applied every run
 *   3. seeds/       idempotent reference data
 *   4. grants       least privilege for the app and analytics roles
 *
 * Each migration runs in its own transaction; a checksum mismatch on an
 * already-applied file stops the run, because editing history is a bug.
 *
 *   npm run db:migrate
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DATABASE_DIR = process.env.DATABASE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../database");
const PG_DIR = join(DATABASE_DIR, "postgresql");

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith("CHANGE_ME")) throw new Error(`${name} is required for database setup`);
  return v;
}

const quoteIdent = (name: string) => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error(`unsafe role name: ${name}`);
  return `"${name}"`;
};

const sqlFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

export async function migratePostgres(log: (msg: string) => void = console.log): Promise<void> {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "mmry",
    user: required("POSTGRES_OWNER_USER"),
    password: required("POSTGRES_OWNER_PASSWORD"),
    application_name: "mmry-migrate",
  });
  await client.connect();
  try {
    // Serialise concurrent runs (e.g. two containers starting together).
    await client.query("SELECT pg_advisory_lock(727274)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const applied = new Map(
      (await client.query<{ filename: string; checksum: string }>("SELECT filename, checksum FROM schema_migrations")).rows.map(
        (r) => [r.filename, r.checksum],
      ),
    );

    for (const file of sqlFiles(join(PG_DIR, "migrations"))) {
      const sql = readFileSync(join(PG_DIR, "migrations", file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const known = applied.get(file);
      if (known) {
        if (known !== checksum) throw new Error(`migration ${file} was modified after it was applied`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
        log(`  applied   migrations/${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }

    for (const folder of ["schema", "seeds"]) {
      for (const file of sqlFiles(join(PG_DIR, folder))) {
        await client.query(readFileSync(join(PG_DIR, folder, file), "utf8"));
        log(`  refreshed ${folder}/${file}`);
      }
    }

    const app = quoteIdent(required("POSTGRES_APP_USER"));
    const analytics = quoteIdent(required("POSTGRES_ANALYTICS_USER"));
    await client.query(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${app}, ${analytics};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app};
      REVOKE INSERT, UPDATE, DELETE ON patient_daily_metrics, analytics_runs, task_templates, person_templates, schema_migrations FROM ${app};
      REVOKE ALL ON schema_migrations FROM ${app};
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${analytics};
      REVOKE ALL ON users, refresh_tokens, schema_migrations FROM ${analytics};
      GRANT INSERT, UPDATE, DELETE ON patient_daily_metrics TO ${analytics};
      GRANT INSERT, UPDATE ON analytics_runs TO ${analytics};
    `);
    log("  granted   least-privilege access to the app and analytics roles");
  } finally {
    await client.query("SELECT pg_advisory_unlock(727274)").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migratePostgres()
    .then(() => console.log("postgres ready"))
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}
