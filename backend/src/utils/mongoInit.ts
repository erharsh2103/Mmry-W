/*
 * MongoDB setup, run with the ROOT account: creates each collection with its
 * $jsonSchema validator and indexes, or updates them (collMod) if the
 * collection exists. Definitions live in database/mongodb.
 *
 *   npm run db:mongo:init
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, type IndexDirection } from "mongodb";

const DATABASE_DIR = process.env.DATABASE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../database");
const MONGO_DIR = join(DATABASE_DIR, "mongodb");

interface CollectionSpec {
  name: string;
  schema: string;
  indexes: { name: string; key: Record<string, IndexDirection>; unique?: boolean; expireAfterSeconds?: number }[];
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith("CHANGE_ME")) throw new Error(`${name} is required for database setup`);
  return v;
}

/* MongoDB's $jsonSchema rejects annotation keywords it does not implement. */
function stripComments(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripComments);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => k !== "$comment")
        .map(([k, v]) => [k, stripComments(v)]),
    );
  }
  return node;
}

export async function initMongo(log: (msg: string) => void = console.log): Promise<void> {
  const dbName = process.env.MONGO_DB ?? "mmry";
  const uri =
    `mongodb://${encodeURIComponent(required("MONGO_ROOT_USER"))}:${encodeURIComponent(required("MONGO_ROOT_PASSWORD"))}` +
    `@${process.env.MONGO_HOST ?? "127.0.0.1"}:${process.env.MONGO_PORT ?? 27017}/?authSource=admin`;
  const client = new MongoClient(uri, { appName: "mmry-mongo-init", serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  try {
    const db = client.db(dbName);
    const { collections } = JSON.parse(readFileSync(join(MONGO_DIR, "collections", "collections.json"), "utf8")) as {
      collections: CollectionSpec[];
    };
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

    for (const spec of collections) {
      const schema = stripComments(JSON.parse(readFileSync(join(MONGO_DIR, "schemas", spec.schema), "utf8")));
      const validator = { $jsonSchema: schema };
      if (existing.has(spec.name)) {
        await db.command({ collMod: spec.name, validator, validationLevel: "strict", validationAction: "error" });
        log(`  updated   ${spec.name} validator`);
      } else {
        await db.createCollection(spec.name, { validator, validationLevel: "strict", validationAction: "error" });
        log(`  created   ${spec.name}`);
      }
      const coll = db.collection(spec.name);
      for (const ix of spec.indexes) {
        await coll.createIndex(ix.key, {
          name: ix.name,
          unique: ix.unique ?? false,
          ...(ix.expireAfterSeconds !== undefined ? { expireAfterSeconds: ix.expireAfterSeconds } : {}),
        });
      }
      log(`  indexed   ${spec.name} (${spec.indexes.map((i) => i.name).join(", ")})`);
    }
  } finally {
    await client.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  initMongo()
    .then(() => console.log("mongodb ready"))
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}
