// src/middlewares/requestTiming.ts

import type { NextFunction, Request, Response } from 'express';

const SLOW_REQUEST_THRESHOLD_MS = 750;

export const requestTimingMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        if (durationMs < SLOW_REQUEST_THRESHOLD_MS) {
            return;
        }

        console.warn('Slow HTTP request', {
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: res.statusCode,
            durationMs: Math.round(durationMs),
            contentLength: res.getHeader('content-length') ?? null
        });
    });

    next();
};
