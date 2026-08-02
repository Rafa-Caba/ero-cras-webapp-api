// src/config/database.ts

import mongoose from 'mongoose';
import { env } from './env';

export const connectDatabase = async (): Promise<void> => {
    await mongoose.connect(env.mongoUri);
};

export const disconnectDatabase = async (): Promise<void> => {
    await mongoose.disconnect();
};
