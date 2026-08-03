// src/validations/schemas/push.schemas.ts

import type { Request } from 'express';
import { AppError } from '../../errors/AppError';
import type {
    PushPlatform,
    RegisterPushDeviceInput
} from '../../types/push.types';
import {
    parseRequestBody,
    readOptionalString,
    readRequiredString
} from './common.schemas';

const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

const requireMaximumLength = (
    value: string,
    fieldName: string,
    maximumLength: number
): string => {
    if (value.length > maximumLength) {
        throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${fieldName} must contain at most ${maximumLength} characters`
        );
    }

    return value;
};

const optionalBoundedString = (
    value: string | undefined,
    fieldName: string,
    maximumLength: number
): string | undefined => {
    if (value === undefined) {
        return undefined;
    }

    return requireMaximumLength(value, fieldName, maximumLength);
};

const parsePlatform = (value: string): PushPlatform => {
    const normalized = value.trim().toUpperCase();

    if (normalized !== 'IOS' && normalized !== 'ANDROID') {
        throw new AppError(
            400,
            'INVALID_PUSH_PLATFORM',
            'platform must be IOS or ANDROID'
        );
    }

    return normalized;
};

export const parseRegisterPushDeviceInput = (
    req: Request
): RegisterPushDeviceInput => {
    const body = parseRequestBody(req);
    const deviceId = requireMaximumLength(
        readRequiredString(body, 'deviceId'),
        'deviceId',
        200
    );
    const expoPushToken = requireMaximumLength(
        readRequiredString(body, 'expoPushToken'),
        'expoPushToken',
        256
    );

    if (!EXPO_PUSH_TOKEN_PATTERN.test(expoPushToken)) {
        throw new AppError(
            400,
            'INVALID_EXPO_PUSH_TOKEN',
            'expoPushToken must be a valid Expo push token'
        );
    }

    return {
        deviceId,
        expoPushToken,
        platform: parsePlatform(readRequiredString(body, 'platform')),
        deviceName: optionalBoundedString(
            readOptionalString(body, 'deviceName'),
            'deviceName',
            120
        ),
        appVersion: optionalBoundedString(
            readOptionalString(body, 'appVersion'),
            'appVersion',
            50
        )
    };
};
