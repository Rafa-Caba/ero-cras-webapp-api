// src/config/database.ts

import mongoose from 'mongoose';
import { env } from './env';

export const connectDatabase = async (): Promise<void> => {
    await mongoose.connect(env.mongoUri, {
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 8_000,
        socketTimeoutMS: 30_000,
        maxIdleTimeMS: 60_000
    });
};

export const disconnectDatabase = async (): Promise<void> => {
    await mongoose.disconnect();
};
