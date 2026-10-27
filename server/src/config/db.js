import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let memServer = null;

export async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tradesim';
  
  try {
    // Attempt standard connection with a short timeout first
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[Database] Connected to MongoDB at ${uri}`);
  } catch (err) {
    console.warn(`[Database] Direct MongoDB connection failed (${err.message}). Starting embedded MongoMemoryServer...`);
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memServer = await MongoMemoryServer.create();
      const memUri = memServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[Database] Connected to embedded MongoMemoryServer at ${memUri}`);
    } catch (memErr) {
      console.error('[Database] Failed to start in-memory Mongo server:', memErr);
      throw memErr;
    }
  }

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memServer) {
    await memServer.stop();
  }
}
