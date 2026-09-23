import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectMongo, mongoClient } from "./config/mongo.js";
import { pool } from "./config/postgres.js";
import { createApp } from "./app.js";
import { refreshTokensRepository } from "./repositories/users.repository.js";
import { deliverLocationNotifications, notificationDeliveryEnabled } from "./services/notification.service.js";

async function main() {
  await pool.query("SELECT 1");
  await connectMongo();

  const server = createApp().listen(env.BACKEND_PORT, () => {
    logger.info("mmry backend listening", { port: env.BACKEND_PORT, env: env.NODE_ENV });
  });

  const sweep = setInterval(() => {
    refreshTokensRepository
      .deleteExpired()
      .then((n) => n && logger.info("expired refresh tokens removed", { count: n }))
      .catch((err: Error) => logger.warn("token sweep failed", { error: err.message }));
  }, 6 * 3_600_000);
  sweep.unref();

  const notifications = setInterval(() => {
    deliverLocationNotifications()
      .then((n) => n && logger.info("location notifications delivered", { count: n }))
      .catch((err: Error) => logger.warn("location notification sweep failed", { error: err.message }));
  }, 15_000);
  notifications.unref();
  if (!notificationDeliveryEnabled()) logger.info("location notification delivery disabled", { reason: "Twilio is not configured" });

  const shutdown = (signal: string) => {
    logger.info("shutting down", { signal });
    server.close(async () => {
      clearInterval(notifications);
      await Promise.allSettled([pool.end(), mongoClient.close()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: Error) => {
  logger.error("startup failed", { error: err.message });
  process.exit(1);
});
