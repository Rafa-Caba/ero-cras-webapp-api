// src/validations/schemas/user.schemas.ts

import type { Request } from 'express';
import { AppError } from '../../errors/AppError';
import type {
    CreateUserInput,
    TenantUserRole,
    UpdateProfileInput,
    UpdateUserInput
} from '../../types/user.types';
import {
    parseRequestBody,
    readOptionalBoolean,
    readOptionalObjectId,
    readOptionalString,
    readRequiredString
} from './common.schemas';

const TENANT_USER_ROLES: readonly TenantUserRole[] = [
    'ADMIN',
    'EDITOR',
    'USER',
    'VIEWER'
];

const validateName = (value: string): string => {
    if (value.length < 2 || value.length > 100) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'name must contain between 2 and 100 characters'
        );
    }

    return value;
};

const validateUsername = (value: string): string => {
    const normalizedValue = value.toLowerCase();

    if (
        normalizedValue.length < 3 ||
        normalizedValue.length > 50 ||
        !/^[a-z0-9._-]+$/.test(normalizedValue)
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'username must contain 3 to 50 letters, numbers, dots, underscores, or hyphens'
        );
    }

    return normalizedValue;
};

const validateEmail = (value: string): string => {
    const normalizedValue = value.toLowerCase();

    if (
        normalizedValue.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'email must contain a valid email address'
        );
    }

    return normalizedValue;
};

const validateTemporaryPassword = (
    value: string | undefined
): string | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (
        value.length < 12 ||
        value.length > 128 ||
        !/[A-Z]/.test(value) ||
        !/[a-z]/.test(value) ||
        !/[0-9]/.test(value) ||
        !/[^A-Za-z0-9]/.test(value)
    ) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'temporaryPassword must contain 12 to 128 characters with uppercase, lowercase, number, and symbol characters'
        );
    }

    return value;
};

const readTenantRole = (
    value: string | undefined,
    defaultRole?: TenantUserRole
): TenantUserRole | undefined => {
    if (!value) {
        return defaultRole;
    }

    const normalizedRole = value.trim().toUpperCase();
    const role = TENANT_USER_ROLES.find(
        (allowedRole) => allowedRole === normalizedRole
    );

    if (!role) {
        throw new AppError(
            400,
            'INVALID_TENANT_ROLE',
            'role must be ADMIN, EDITOR, USER, or VIEWER'
        );
    }

    return role;
};

const readOptionalValidatedString = (
    req: Request,
    fieldName: string,
    validator: (value: string) => string
): string | undefined => {
    const value = readOptionalString(parseRequestBody(req), fieldName);

    if (value === undefined) {
        return undefined;
    }

    if (!value) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} cannot be empty`
        );
    }

    return validator(value);
};

export const parseCreateUserInput = (req: Request): CreateUserInput => {
    const body = parseRequestBody(req);
    const instrumentId = readOptionalObjectId(body, 'instrumentId');
    const requestedPassword =
        readOptionalString(body, 'temporaryPassword') ??
        readOptionalString(body, 'password');

    return {
        name: validateName(readRequiredString(body, 'name')),
        username: validateUsername(readRequiredString(body, 'username')),
        email: validateEmail(readRequiredString(body, 'email')),
        role: readTenantRole(readOptionalString(body, 'role'), 'VIEWER') ?? 'VIEWER',
        temporaryPassword: validateTemporaryPassword(requestedPassword),
        instrumentId: instrumentId === undefined
            ? undefined
            : instrumentId?.toString() ?? null,
        instrumentLabel:
            readOptionalString(body, 'instrumentLabel') ??
            readOptionalString(body, 'instrument'),
        voice: readOptionalBoolean(body, 'voice') ?? false,
        bio: readOptionalString(body, 'bio')
    };
};

export const parseUpdateUserInput = (req: Request): UpdateUserInput => {
    const body = parseRequestBody(req);
    const instrumentId = readOptionalObjectId(body, 'instrumentId');

    return {
        name: readOptionalValidatedString(req, 'name', validateName),
        username: readOptionalValidatedString(req, 'username', validateUsername),
        email: readOptionalValidatedString(req, 'email', validateEmail),
        role: readTenantRole(readOptionalString(body, 'role')),
        instrumentId: instrumentId === undefined
            ? undefined
            : instrumentId?.toString() ?? null,
        instrumentLabel:
            readOptionalString(body, 'instrumentLabel') ??
            readOptionalString(body, 'instrument'),
        voice: readOptionalBoolean(body, 'voice'),
        bio: readOptionalString(body, 'bio')
    };
};

export const parseUpdateProfileInput = (req: Request): UpdateProfileInput => {
    const body = parseRequestBody(req);
    const instrumentId = readOptionalObjectId(body, 'instrumentId');

    return {
        name: readOptionalValidatedString(req, 'name', validateName),
        username: readOptionalValidatedString(req, 'username', validateUsername),
        email: readOptionalValidatedString(req, 'email', validateEmail),
        instrumentId: instrumentId === undefined
            ? undefined
            : instrumentId?.toString() ?? null,
        instrumentLabel:
            readOptionalString(body, 'instrumentLabel') ??
            readOptionalString(body, 'instrument'),
        voice: readOptionalBoolean(body, 'voice'),
        bio: readOptionalString(body, 'bio')
    };
};

export const parseUserActiveStatus = (req: Request): boolean => {
    const isActive = readOptionalBoolean(parseRequestBody(req), 'isActive');

    if (isActive === undefined) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'isActive is required'
        );
    }

    return isActive;
};

export const parseOptionalTemporaryPassword = (
    req: Request
): string | undefined => {
    const body = parseRequestBody(req);
    const password =
        readOptionalString(body, 'temporaryPassword') ??
        readOptionalString(body, 'password');

    return validateTemporaryPassword(password);
};
