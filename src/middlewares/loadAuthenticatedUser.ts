// src/middlewares/loadAuthenticatedUser.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import User from '../models/User';
import { serializeAuthenticatedUser } from '../services/auth.service';
import type { RequestWithUser } from '../types/auth.types';

export const loadAuthenticatedUser = async (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.authToken) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'Authentication must run before loading the user'
        );
    }

    const userDocument = await User.findById(req.authToken.sub);

    if (!userDocument) {
        throw new AppError(
            401,
            'AUTHENTICATED_USER_NOT_FOUND',
            'The authenticated user no longer exists'
        );
    }

    const user = serializeAuthenticatedUser(userDocument);

    if (user.sessionVersion !== req.authToken.sv) {
        throw new AppError(
            401,
            'SESSION_REVOKED',
            'The session has been revoked'
        );
    }

    req.user = user;
    req.auth = {
        tokenId: req.authToken.jti,
        user,
        choir: null,
        targetChoir: null,
        effectiveChoirId: user.choirId
    };

    next();
};
