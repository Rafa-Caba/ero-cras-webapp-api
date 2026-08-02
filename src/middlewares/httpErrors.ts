// src/middlewares/httpErrors.ts

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { ApiErrorResponse } from '../types/http.types';

export const notFoundHandler = (
    req: Request,
    res: Response<ApiErrorResponse>
): void => {
    res.status(404).json({
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        code: 'ROUTE_NOT_FOUND'
    });
};

export const errorHandler = (
    error: Error,
    _req: Request,
    res: Response<ApiErrorResponse>,
    _next: NextFunction
): void => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            message: error.message,
            code: error.code,
            details: error.details
        });
        return;
    }

    if (error.name === 'MongoServerError' && error.message.includes('E11000')) {
        res.status(409).json({
            message: 'A record with the same unique identifiers already exists',
            code: 'DUPLICATE_RECORD'
        });
        return;
    }

    console.error(error);
    res.status(500).json({
        message: 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR'
    });
};
