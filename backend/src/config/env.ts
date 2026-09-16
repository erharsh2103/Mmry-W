/*
 * Environment configuration, validated once at startup.
 *
 * The process refuses to start when a secret is missing, still holds a
 * CHANGE_ME placeholder, or is too short. Nothing sensitive has a default.
 */
import { z } from "zod";

const secret = (name: string, min: number) =>
  z
    .string({ error: `${name} is required` })
    .min(min, `${name} must be at least ${min} characters`)
    .refine((v) => !v.startsWith("CHANGE_ME"), `${name} still holds the .env.example placeholder`);

const port = z.coerce.number().int().min(1).max(65535);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  BACKEND_PORT: port.default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  POSTGRES_HOST: z.string().min(1).default("127.0.0.1"),
  POSTGRES_PORT: port.default(5432),
  POSTGRES_DB: z.string().min(1).default("mmry"),
  POSTGRES_APP_USER: z.string().min(1),
  POSTGRES_APP_PASSWORD: secret("POSTGRES_APP_PASSWORD", 12),
  POSTGRES_ANALYTICS_USER: z.string().min(1).optional(),

  MONGO_HOST: z.string().min(1).default("127.0.0.1"),
  MONGO_PORT: port.default(27017),
  MONGO_DB: z.string().min(1).default("mmry"),
  MONGO_APP_USER: z.string().min(1),
  MONGO_APP_PASSWORD: secret("MONGO_APP_PASSWORD", 12),

  JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET", 32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),

  DATA_ENCRYPTION_KEY: secret("DATA_ENCRYPTION_KEY", 40).refine(
    (v) => Buffer.from(v, "base64").length === 32,
    "DATA_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded",
  ),

  AI_SERVICE_URL: z.url().default("http://127.0.0.1:8000"),
  AI_SERVICE_TOKEN: secret("AI_SERVICE_TOKEN", 32),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(200).max(30000).default(4000),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
    // Deliberately not the logger: this runs before anything else exists.
    console.error(`Invalid environment configuration:\n${lines.join("\n")}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export const isProduction = env.NODE_ENV === "production";
