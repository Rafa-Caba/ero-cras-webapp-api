// src/validations/schemas/tenant.schemas.ts

import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';

export const parseTargetChoirHeader = (
    headerValue: string | string[] | undefined
): string | null => {
    if (headerValue === undefined) {
        return null;
    }

    if (typeof headerValue !== 'string') {
        throw new AppError(
            400,
            'INVALID_TARGET_CHOIR',
            'x-target-choir-id must contain exactly one choir identifier'
        );
    }

    const targetChoirId = headerValue.trim();

    if (!Types.ObjectId.isValid(targetChoirId)) {
        throw new AppError(
            400,
            'INVALID_TARGET_CHOIR',
            'x-target-choir-id must contain a valid MongoDB ObjectId'
        );
    }

    return targetChoirId;
};
