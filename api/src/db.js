import mongoose from 'mongoose';
import { env } from './config.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('[MongoDB] Conectado');
}
