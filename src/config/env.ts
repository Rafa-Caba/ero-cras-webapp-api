// src/config/env.ts

import dotenv from 'dotenv';

const nodeEnvironment = process.env.NODE_ENV ?? 'development';
const environmentFile = process.env.ENV_FILE ?? `.env.${nodeEnvironment}`;

dotenv.config({ path: environmentFile });

const requireString = (name: string): string => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const optionalString = (name: string): string | undefined => {
    const value = process.env[name]?.trim();
    return value || undefined;
};

const parseBoolean = (name: string, defaultValue: boolean): boolean => {
    const value = optionalString(name);

    if (!value) {
        return defaultValue;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    throw new Error(`${name} must be either "true" or "false"`);
};

const parsePositiveInteger = (name: string, defaultValue: number): number => {
    const value = optionalString(name);

    if (!value) {
        return defaultValue;
    }

    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return parsedValue;
};

const requireSecureSecret = (name: string): string => {
    const value = requireString(name);

    if (value.length < 32) {
        throw new Error(`${name} must contain at least 32 characters`);
    }

    return value;
};

const allowSuperAdminBootstrap = parseBoolean(
    'ALLOW_SUPER_ADMIN_BOOTSTRAP',
    false
);

const superAdminBootstrapToken = allowSuperAdminBootstrap
    ? requireSecureSecret('SUPER_ADMIN_BOOTSTRAP_TOKEN')
    : optionalString('SUPER_ADMIN_BOOTSTRAP_TOKEN');

export interface EnvironmentConfig {
    readonly nodeEnv: string;
    readonly port: number;
    readonly mongoUri: string;
    readonly corsOrigins: readonly string[];
    readonly jwt: {
        readonly accessSecret: string;
        readonly refreshSecret: string;
        readonly accessExpiresInSeconds: number;
        readonly refreshExpiresInSeconds: number;
        readonly issuer: string;
        readonly audience: string;
    };
    readonly bootstrap: {
        readonly enabled: boolean;
        readonly token?: string;
    };
    readonly databaseReset: {
        readonly enabled: boolean;
        readonly confirmation?: string;
    };
}

const corsOrigins = requireString('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
}

export const env: EnvironmentConfig = {
    nodeEnv: nodeEnvironment,
    port: parsePositiveInteger('PORT', 10000),
    mongoUri: requireString('MONGO_URI'),
    corsOrigins,
    jwt: {
        accessSecret: requireSecureSecret('JWT_ACCESS_SECRET'),
        refreshSecret: requireSecureSecret('JWT_REFRESH_SECRET'),
        accessExpiresInSeconds: parsePositiveInteger(
            'JWT_ACCESS_EXPIRES_IN_SECONDS',
            900
        ),
        refreshExpiresInSeconds: parsePositiveInteger(
            'JWT_REFRESH_EXPIRES_IN_SECONDS',
            604800
        ),
        issuer: optionalString('JWT_ISSUER') ?? 'ero-cras-api',
        audience: optionalString('JWT_AUDIENCE') ?? 'ero-cras-clients'
    },
    bootstrap: {
        enabled: allowSuperAdminBootstrap,
        token: superAdminBootstrapToken
    },
    databaseReset: {
        enabled: parseBoolean('ALLOW_DATABASE_RESET', false),
        confirmation: optionalString('DATABASE_RESET_CONFIRMATION')
    }
};
