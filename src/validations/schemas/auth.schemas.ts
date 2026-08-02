// src/validations/schemas/auth.schemas.ts

import { AppError } from '../../errors/AppError';

export type RequestBodyValue = string | number | boolean | object | null;

export interface AuthRequestBody {
    readonly name?: RequestBodyValue;
    readonly username?: RequestBodyValue;
    readonly email?: RequestBodyValue;
    readonly password?: RequestBodyValue;
    readonly choirCode?: RequestBodyValue;
    readonly identifier?: RequestBodyValue;
    readonly refreshToken?: RequestBodyValue;
    readonly currentPassword?: RequestBodyValue;
    readonly newPassword?: RequestBodyValue;
}

export interface BootstrapSuperAdminInput {
    readonly name: string;
    readonly username: string;
    readonly email: string;
    readonly password: string;
}

export interface TenantLoginInput {
    readonly choirCode: string;
    readonly identifier: string;
    readonly password: string;
}

export interface PlatformLoginInput {
    readonly identifier: string;
    readonly password: string;
}

export interface ChangePasswordInput {
    readonly currentPassword: string;
    readonly newPassword: string;
}

export interface RefreshSessionInput {
    readonly refreshToken: string;
}

const requireBody = (
    body: AuthRequestBody | undefined
): AuthRequestBody => {
    if (!body) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'A JSON request body is required'
        );
    }

    return body;
};

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

const validateChoirCode = (choirCode: string): string => {
    const normalizedChoirCode = choirCode.toLowerCase();
    const choirCodePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!choirCodePattern.test(normalizedChoirCode)) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            'choirCode must use lowercase letters, numbers, and single hyphens'
        );
    }

    return normalizedChoirCode;
};

const validatePasswordStrength = (password: string): string => {
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
    const requestBody = requireBody(body);
    const name = requireText(requestBody.name, 'name', 2, 100);
    const username = validateUsername(
        requireText(requestBody.username, 'username', 3, 50)
    );
    const email = validateEmail(
        requireText(requestBody.email, 'email', 5, 254)
    );
    const password = validatePasswordStrength(
        requireText(requestBody.password, 'password', 12, 128)
    );

    return { name, username, email, password };
};

export const parseTenantLoginBody = (
    body: AuthRequestBody | undefined
): TenantLoginInput => {
    const requestBody = requireBody(body);

    return {
        choirCode: validateChoirCode(
            requireText(requestBody.choirCode, 'choirCode', 2, 60)
        ),
        identifier: requireText(
            requestBody.identifier,
            'identifier',
            3,
            254
        ).toLowerCase(),
        password: requireText(requestBody.password, 'password', 1, 128)
    };
};

export const parsePlatformLoginBody = (
    body: AuthRequestBody | undefined
): PlatformLoginInput => {
    const requestBody = requireBody(body);

    return {
        identifier: requireText(
            requestBody.identifier,
            'identifier',
            3,
            254
        ).toLowerCase(),
        password: requireText(requestBody.password, 'password', 1, 128)
    };
};

export const parseChangePasswordBody = (
    body: AuthRequestBody | undefined
): ChangePasswordInput => {
    const requestBody = requireBody(body);

    return {
        currentPassword: requireText(
            requestBody.currentPassword,
            'currentPassword',
            1,
            128
        ),
        newPassword: validatePasswordStrength(
            requireText(requestBody.newPassword, 'newPassword', 12, 128)
        )
    };
};

export const parseRefreshSessionBody = (
    body: AuthRequestBody | undefined
): RefreshSessionInput => {
    const requestBody = requireBody(body);

    return {
        refreshToken: requireText(
            requestBody.refreshToken,
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
