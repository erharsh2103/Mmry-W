/*
 * Prepare both databases in one step (used by the docker-compose db-setup job).
 *
 *   npm run db:setup
 */
import { initMongo } from "./mongoInit.js";
import { migratePostgres } from "./migrate.js";

try {
  console.log("postgresql:");
  await migratePostgres();
  console.log("mongodb:");
  await initMongo();
  console.log("databases ready");
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
