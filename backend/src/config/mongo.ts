/*
 * MongoDB client for document-shaped data only: game event trails, mind-check
 * answers, talk-companion turns and AI inference logs.
 */
import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";
import { logger } from "./logger.js";

const uri =
  `mongodb://${encodeURIComponent(env.MONGO_APP_USER)}:${encodeURIComponent(env.MONGO_APP_PASSWORD)}` +
  `@${env.MONGO_HOST}:${env.MONGO_PORT}/${encodeURIComponent(env.MONGO_DB)}?authSource=${encodeURIComponent(env.MONGO_DB)}`;

export const mongoClient = new MongoClient(uri, {
  appName: "mmry-backend",
  serverSelectionTimeoutMS: 5_000,
  maxPoolSize: 10,
});

let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  await mongoClient.connect();
  db = mongoClient.db(env.MONGO_DB);
  logger.info("mongodb connected", { db: env.MONGO_DB });
  return db;
}

export function mongo(): Db {
  if (!db) throw new Error("MongoDB is not connected - call connectMongo() at startup");
  return db;
}

export async function pingMongo(): Promise<boolean> {
  try {
    await mongo().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
