/* Test-only configuration, set before any module reads config/env.ts. */
import { randomBytes } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.POSTGRES_APP_USER ??= "mmry_test";
process.env.POSTGRES_APP_PASSWORD ??= "test-password-not-used";
process.env.MONGO_APP_USER ??= "mmry_test";
process.env.MONGO_APP_PASSWORD ??= "test-password-not-used";
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString("hex");
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.AI_SERVICE_TOKEN = randomBytes(32).toString("hex");
process.env.AI_SERVICE_URL = "http://127.0.0.1:9";
