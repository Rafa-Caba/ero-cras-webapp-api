// src/validations/schemas/auth.schemas.ts

import { AppError } from '../../errors/AppError';

export type RequestBodyValue = string | number | boolean | object | null;

export interface AuthRequestBody {
    readonly name?: RequestBodyValue;
    readonly username?: RequestBodyValue;
    readonly email?: RequestBodyValue;
    readonly password?: RequestBodyValue;
    readonly refreshToken?: RequestBodyValue;
}

export interface BootstrapSuperAdminInput {
    readonly name: string;
    readonly username: string;
    readonly email: string;
    readonly password: string;
}

export interface RefreshSessionInput {
    readonly refreshToken: string;
}

const requireText = (
    value: RequestBodyValue | undefined,
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

const validateEmail = (email: string): string => {
    const normalizedEmail = email.toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'email must contain a valid email address'
        );
    }

    return normalizedEmail;
};

const validateUsername = (username: string): string => {
    const normalizedUsername = username.toLowerCase();
    const usernamePattern = /^[a-z0-9._-]+$/;

    if (!usernamePattern.test(normalizedUsername)) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'username may only contain letters, numbers, dots, underscores, and hyphens'
        );
    }

    return normalizedUsername;
};

const validatePassword = (password: string): string => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'password must include uppercase, lowercase, number, and symbol characters'
        );
    }

    return password;
};

export const parseBootstrapSuperAdminBody = (
    body: AuthRequestBody | undefined
): BootstrapSuperAdminInput => {
    if (!body) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A JSON request body is required'
        );
    }
    const name = requireText(body.name, 'name', 2, 100);
    const username = validateUsername(
        requireText(body.username, 'username', 3, 50)
    );
    const email = validateEmail(requireText(body.email, 'email', 5, 254));
    const password = validatePassword(
        requireText(body.password, 'password', 12, 128)
    );

    return {
        name,
        username,
        email,
        password
    };
};

export const parseRefreshSessionBody = (
    body: AuthRequestBody | undefined
): RefreshSessionInput => {
    if (!body) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A JSON request body is required'
        );
    }
    return {
        refreshToken: requireText(
            body.refreshToken,
            'refreshToken',
            20,
            4096
        )
    };
};

export const parseBootstrapTokenHeader = (
    headerValue: string | string[] | undefined
): string => {
    if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
        throw new AppError(
            401,
            'BOOTSTRAP_TOKEN_REQUIRED',
            'A valid x-bootstrap-token header is required'
        );
    }

    return headerValue.trim();
};
