// src/validations/schemas/common.schemas.ts

import type { Request } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import type {
    PaginationQuery,
    PaginationResult,
    RequestBody,
    RequestValue
} from '../../types/request.types';

const isRequestBody = (value: RequestValue): value is RequestBody => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const parseRequestBody = (req: Request): RequestBody => {
    const rawBody: RequestValue = req.body;

    if (!isRequestBody(rawBody)) {
        return {};
    }

    if (typeof rawBody.data !== 'string') {
        return rawBody;
    }

    let parsedBody: object;

    try {
        parsedBody = JSON.parse(rawBody.data);
    } catch {
        throw new AppError(
            400,
            'INVALID_MULTIPART_DATA',
            'The multipart data field must contain valid JSON'
        );
    }

    if (!isRequestBody(parsedBody)) {
        throw new AppError(
            400,
            'INVALID_MULTIPART_DATA',
            'The multipart data field must contain a JSON object'
        );
    }

    return parsedBody;
};

export const readRequiredString = (
    body: RequestBody,
    fieldName: string
): string => {
    const value = body[fieldName];

    if (typeof value !== 'string' || !value.trim()) {
        throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is required`);
    }

    return value.trim();
};

export const readOptionalString = (
    body: RequestBody,
    fieldName: string
): string | undefined => {
    const value = body[fieldName];

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must be a string`
        );
    }

    return value.trim();
};

export const readOptionalBoolean = (
    body: RequestBody,
    fieldName: string
): boolean | undefined => {
    const value = body[fieldName];

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    throw new AppError(
        400,
        'VALIDATION_ERROR',
        `${fieldName} must be a boolean`
    );
};

export const readOptionalNumber = (
    body: RequestBody,
    fieldName: string
): number | undefined => {
    const value = body[fieldName];

    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const numericValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must be a number`
        );
    }

    return numericValue;
};

export const readOptionalObject = (
    body: RequestBody,
    fieldName: string
): object | undefined => {
    const value = body[fieldName];

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        let parsedValue: object;

        try {
            parsedValue = JSON.parse(value);
        } catch {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                `${fieldName} must contain valid JSON`
            );
        }

        if (typeof parsedValue !== 'object' || parsedValue === null) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                `${fieldName} must be an object`
            );
        }

        return parsedValue;
    }

    if (typeof value !== 'object') {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must be an object`
        );
    }

    return value;
};

export const readRequiredContent = (
    body: RequestBody,
    fieldName: string
): string | object => {
    const value = body[fieldName];

    if (typeof value === 'string') {
        if (!value.trim()) {
            throw new AppError(
                400,
                'VALIDATION_ERROR',
                `${fieldName} is required`
            );
        }

        try {
            const parsedValue: object = JSON.parse(value);
            return parsedValue;
        } catch {
            return value.trim();
        }
    }

    if (typeof value === 'object' && value !== null) {
        return value;
    }

    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is required`);
};

export const readOptionalObjectId = (
    body: RequestBody,
    fieldName: string
): Types.ObjectId | null | undefined => {
    const value = body[fieldName];

    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
        throw new AppError(
            400,
            'INVALID_OBJECT_ID',
            `${fieldName} must be a valid ObjectId`
        );
    }

    return new Types.ObjectId(value);
};

export const parseObjectId = (
    value: string,
    fieldName = 'id'
): Types.ObjectId => {
    if (!Types.ObjectId.isValid(value)) {
        throw new AppError(
            400,
            'INVALID_OBJECT_ID',
            `${fieldName} must be a valid ObjectId`
        );
    }

    return new Types.ObjectId(value);
};

export const parsePagination = (
    query: PaginationQuery,
    defaultLimit = 10,
    maxLimit = 100
): PaginationResult => {
    const pageCandidate = Number(query.page ?? '1');
    const limitCandidate = Number(query.limit ?? String(defaultLimit));
    const page = Number.isInteger(pageCandidate) && pageCandidate > 0
        ? pageCandidate
        : 1;
    const normalizedLimit = Number.isInteger(limitCandidate) && limitCandidate > 0
        ? limitCandidate
        : defaultLimit;
    const limit = Math.min(normalizedLimit, maxLimit);

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};

export const readQueryString = (
    value: Request['query'][string]
): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();
    return normalizedValue || undefined;
};
