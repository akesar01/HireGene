import { MongoClient, type Db, type Collection } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "hiregene";

const globalForMongo = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
};

let client: MongoClient | undefined;

if (MONGODB_URI) {
  client =
    globalForMongo.mongoClient ??
    new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForMongo.mongoClient = client;
  }
} else {
  console.warn("[Mongo] MONGODB_URI not set — profile features will be unavailable");
}

export function getDb(): Db | null {
  if (!client) return null;
  return client.db(DB_NAME);
}

export function getProfilesCollection(): Collection | null {
  const db = getDb();
  if (!db) return null;
  return db.collection("profiles");
}
