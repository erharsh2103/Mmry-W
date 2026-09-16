/*
 * PostgreSQL connection pool for the API's least-privileged runtime role.
 */
import pg from "pg";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Return NUMERIC as number and DATE as a plain YYYY-MM-DD string. The values
// stored here (accuracy, voice rate, hour) are small and well inside double
// precision; dates are calendar days with no time zone.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_APP_USER,
  password: env.POSTGRES_APP_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  application_name: "mmry-backend",
});

pool.on("error", (err) => logger.error("postgres pool error", { error: err.message }));

export type Queryable = Pick<pg.PoolClient, "query">;

/* Run `fn` inside a transaction on one client; rolls back on any throw. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function pingPostgres(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
