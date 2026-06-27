import { MongoClient, type Db, type Collection } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "hiregene";

const globalForMongo = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
  mongoConnPromise: Promise<MongoClient> | undefined;
};

function getClientPromise(): Promise<MongoClient> | null {
  if (!MONGODB_URI) {
    console.warn("[Mongo] MONGODB_URI not set — profile features will be unavailable");
    return null;
  }

  if (!globalForMongo.mongoConnPromise) {
    const client =
      globalForMongo.mongoClient ??
      new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
      });

    globalForMongo.mongoClient = client;
    globalForMongo.mongoConnPromise = client.connect();
  }

  return globalForMongo.mongoConnPromise;
}

export async function getDb(): Promise<Db | null> {
  const promise = getClientPromise();
  if (!promise) return null;
  const client = await promise;
  return client.db(DB_NAME);
}

export async function getProfilesCollection(): Promise<Collection | null> {
  const db = await getDb();
  if (!db) return null;
  return db.collection("profiles");
}
