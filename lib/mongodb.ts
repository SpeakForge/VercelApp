import { MongoClient, Collection } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Please add MONGODB_URI to .env.local");
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// In development reuse the connection across hot-reloads to avoid exhausting connections
if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getUsersCollection(): Promise<Collection> {
  const c = await clientPromise;
  const col = c.db("speakforge").collection("users");
  await col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  return col;
}

export default clientPromise;
