/**
 * MongoDB connection for the main app.
 * Connects once and reuses the connection.
 */

import mongoose from 'mongoose';

let connected = false;

export async function connectMongo() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set — MongoDB storage unavailable');
    return;
  }
  try {
    await mongoose.connect(uri);
    connected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.warn('⚠️  MongoDB connection failed:', err.message);
  }
}

export function isMongoConnected() {
  return connected && mongoose.connection.readyState === 1;
}
