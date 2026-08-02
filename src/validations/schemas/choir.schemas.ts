// src/validations/schemas/choir.schemas.ts

import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';

export interface ChoirMutationBody {
    readonly name?: string;
    readonly code?: string;
    readonly description?: string;
    readonly isActive?: string | boolean;
}

export interface CreateChoirInput {
    readonly name: string;
    readonly code: string;
    readonly description: string;
    readonly isActive: boolean;
}

export interface UpdateChoirInput {
    readonly name?: string;
    readonly code?: string;
    readonly description?: string;
    readonly isActive?: boolean;
}

const normalizeRequiredText = (
    value: string | undefined,
    fieldName: string,
    minimumLength: number,
    maximumLength: number
): string => {
    if (typeof value !== 'string') {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must be a string`
        );
    }

    const normalizedValue = value.trim();

    if (
        normalizedValue.length < minimumLength ||
        normalizedValue.length > maximumLength
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must contain between ${minimumLength} and ${maximumLength} characters`
        );
    }

    return normalizedValue;
};

const normalizeOptionalText = (
    value: string | undefined,
    fieldName: string,
    maximumLength: number
): string | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must be a string`
        );
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length > maximumLength) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} cannot exceed ${maximumLength} characters`
        );
    }

    return normalizedValue;
};

const normalizeChoirCode = (code: string): string => {
    const normalizedCode = code.trim().toLowerCase();
    const codePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

    if (!codePattern.test(normalizedCode)) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'code may only contain lowercase letters, numbers, and internal hyphens'
        );
    }

    return normalizedCode;
};

const parseBoolean = (
    value: string | boolean | undefined
): boolean | undefined => {
    if (value === undefined) {
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
        'isActive must be either true or false'
    );
};

export const parseCreateChoirBody = (
    body: ChoirMutationBody | undefined
): CreateChoirInput => {
    if (!body) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A choir request body is required'
        );
    }
    const name = normalizeRequiredText(body.name, 'name', 2, 120);
    const code = normalizeChoirCode(
        normalizeRequiredText(body.code, 'code', 1, 50)
    );
    const description = normalizeOptionalText(
        body.description,
        'description',
        1000
    );

    return {
        name,
        code,
        description: description ?? '',
        isActive: parseBoolean(body.isActive) ?? true
    };
};

export const parseUpdateChoirBody = (
    body: ChoirMutationBody | undefined
): UpdateChoirInput => {
    if (!body) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A choir request body is required'
        );
    }
    const name = body.name === undefined
        ? undefined
        : normalizeRequiredText(body.name, 'name', 2, 120);
    const code = body.code === undefined
        ? undefined
        : normalizeChoirCode(
            normalizeRequiredText(body.code, 'code', 1, 50)
        );
    const description = normalizeOptionalText(
        body.description,
        'description',
        1000
    );
    const isActive = parseBoolean(body.isActive);

    if (
        name === undefined &&
        code === undefined &&
        description === undefined &&
        isActive === undefined
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'At least one choir field must be provided'
        );
    }

    return {
        name,
        code,
        description,
        isActive
    };
};

export const parsePositivePage = (
    value: string | undefined
): number => {
    if (!value) {
        return 1;
    }

    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'page must be a positive integer'
        );
    }

    return parsedValue;
};


export const parseChoirIdParam = (value: string): string => {
    if (!Types.ObjectId.isValid(value)) {
        throw new AppError(
            400,
            'INVALID_CHOIR_ID',
            'The choir route parameter must be a valid MongoDB ObjectId'
        );
    }

    return value;
};
