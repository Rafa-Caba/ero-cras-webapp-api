// src/controllers/auth.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import {
    bootstrapSuperAdmin,
    buildCurrentSessionResponse,
    changeAuthenticatedPassword,
    loginPlatformUser,
    loginTenantUser,
    refreshSession,
    revokeRefreshToken
} from '../services/auth.service';
import type { RequestWithUser } from '../types/auth.types';
import type { ApiMessageResponse } from '../types/http.types';
import { Types } from 'mongoose';
import { unregisterPushDevice } from '../services/pushDevice.service';
import {
    AuthRequestBody,
    parseBootstrapSuperAdminBody,
    parseBootstrapTokenHeader,
    parseChangePasswordBody,
    parseLogoutBody,
    parsePlatformLoginBody,
    parseRefreshSessionBody,
    parseTenantLoginBody
} from '../validations/schemas/auth.schemas';

interface AuthBodyRequest extends RequestWithUser {
    body: AuthRequestBody | undefined;
}

export const bootstrapSuperAdminController = async (
    req: Request<Record<string, never>, object, AuthRequestBody | undefined>,
    res: Response
): Promise<void> => {
    const input = parseBootstrapSuperAdminBody(req.body);
    const bootstrapToken = parseBootstrapTokenHeader(
        req.headers['x-bootstrap-token']
    );
    const session = await bootstrapSuperAdmin(input, bootstrapToken);

    res.status(201).json(session);
};

export const loginTenantController = async (
    req: Request<Record<string, never>, object, AuthRequestBody | undefined>,
    res: Response
): Promise<void> => {
    const input = parseTenantLoginBody(req.body);
    const session = await loginTenantUser(input);

    res.json(session);
};

export const loginPlatformController = async (
    req: Request<Record<string, never>, object, AuthRequestBody | undefined>,
    res: Response
): Promise<void> => {
    const input = parsePlatformLoginBody(req.body);
    const session = await loginPlatformUser(input);

    res.json(session);
};

export const refreshSessionController = async (
    req: Request<Record<string, never>, object, AuthRequestBody | undefined>,
    res: Response
): Promise<void> => {
    const input = parseRefreshSessionBody(req.body);
    const session = await refreshSession(input.refreshToken);

    res.json(session);
};

export const changePasswordController = async (
    req: AuthBodyRequest,
    res: Response
): Promise<void> => {
    if (!req.user) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated user has not been loaded'
        );
    }

    const input = parseChangePasswordBody(req.body);
    const session = await changeAuthenticatedPassword(req.user.id, input);

    res.json(session);
};

export const logoutController = async (
    req: AuthBodyRequest,
    res: Response<ApiMessageResponse>
): Promise<void> => {
    if (!req.user) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated user has not been loaded'
        );
    }

    const input = parseLogoutBody(req.body);
    await revokeRefreshToken(req.user.id, input.refreshToken);

    if (input.deviceId) {
        await unregisterPushDevice(
            new Types.ObjectId(req.user.id),
            input.deviceId
        );
    }

    res.json({ message: 'Session closed successfully' });
};

export const getCurrentSessionController = (
    req: RequestWithUser,
    res: Response
): void => {
    if (!req.auth) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated context has not been initialized'
        );
    }

    res.json(buildCurrentSessionResponse(req.auth));
};
