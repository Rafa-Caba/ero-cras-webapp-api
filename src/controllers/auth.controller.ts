// src/controllers/auth.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import {
    bootstrapSuperAdmin,
    buildCurrentSessionResponse,
    refreshSession,
    revokeRefreshToken
} from '../services/auth.service';
import type { RequestWithUser } from '../types/auth.types';
import type { ApiMessageResponse } from '../types/http.types';
import {
    AuthRequestBody,
    parseBootstrapSuperAdminBody,
    parseBootstrapTokenHeader,
    parseRefreshSessionBody
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

export const refreshSessionController = async (
    req: Request<Record<string, never>, object, AuthRequestBody | undefined>,
    res: Response
): Promise<void> => {
    const input = parseRefreshSessionBody(req.body);
    const session = await refreshSession(input.refreshToken);

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

    const input = parseRefreshSessionBody(req.body);
    await revokeRefreshToken(req.user.id, input.refreshToken);

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
