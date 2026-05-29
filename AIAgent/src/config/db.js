import mongoose from 'mongoose';
import config from '../config/env.js';

export async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log(`✅ MongoDB connected: ${config.mongoUri}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
}
