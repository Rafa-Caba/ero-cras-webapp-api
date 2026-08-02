// src/config/cors.ts

import { env } from './env';

export const isOriginAllowed = (origin?: string | null): boolean => {
    if (!origin) {
        return true;
    }

    return env.corsOrigins.some((allowedOrigin) => {
        return origin === allowedOrigin;
    });
};
