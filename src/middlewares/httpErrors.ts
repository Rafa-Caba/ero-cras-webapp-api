// src/middlewares/httpErrors.ts

import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError';
import type { ApiErrorResponse } from '../types/http.types';

interface RequestAbortedError extends Error {
    readonly code?: string;
    readonly expected?: number;
    readonly received?: number;
    readonly type?: string;
}

const isRequestAbortedError = (error: Error): error is RequestAbortedError => {
    const candidate = error as RequestAbortedError;
    return candidate.type === 'request.aborted' || candidate.code === 'ECONNABORTED';
};

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
    req: Request,
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

    if (error instanceof multer.MulterError) {
        const isSizeLimit = error.code === 'LIMIT_FILE_SIZE';

        res.status(isSizeLimit ? 413 : 400).json({
            message: isSizeLimit
                ? 'The uploaded file exceeds the allowed size limit'
                : 'The uploaded file could not be processed',
            code: isSizeLimit
                ? 'MEDIA_FILE_TOO_LARGE'
                : 'MEDIA_UPLOAD_ERROR'
        });
        return;
    }

    if (isRequestAbortedError(error)) {
        console.warn('HTTP request aborted by client', {
            method: req.method,
            path: req.originalUrl,
            expected: error.expected,
            received: error.received
        });

        if (!res.headersSent && !res.writableEnded) {
            res.status(400).json({
                message: 'The request was interrupted before it completed',
                code: 'REQUEST_ABORTED'
            });
        }
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
