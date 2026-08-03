// src/validations/schemas/sync.schemas.ts

import type { Request } from 'express';
import { AppError } from '../../errors/AppError';
import type { SyncQuery } from '../../types/sync.types';

export const parseSyncQuery = (req: Request): SyncQuery => {
    const value = req.query.updatedSince;

    if (value === undefined) {
        return { updatedSince: null };
    }

    if (typeof value !== 'string' || !value.trim()) {
        throw new AppError(
            400,
            'INVALID_UPDATED_SINCE',
            'updatedSince must be a valid ISO date string'
        );
    }

    const updatedSince = new Date(value);

    if (Number.isNaN(updatedSince.getTime())) {
        throw new AppError(
            400,
            'INVALID_UPDATED_SINCE',
            'updatedSince must be a valid ISO date string'
        );
    }

    return { updatedSince };
};
