// src/middlewares/loadAuthenticatedUser.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import User, { IUser } from '../models/User';
import type {
    AuthenticatedUser,
    RequestWithUser
} from '../types/auth.types';
import { isUserRole } from '../types/roles.types';

const serializeAuthenticatedUser = (
    user: IUser | null
): AuthenticatedUser => {
    if (!user) {
        throw new AppError(
            401,
            'AUTHENTICATED_USER_NOT_FOUND',
            'The authenticated user no longer exists'
        );
    }

    if (!isUserRole(user.role)) {
        throw new AppError(
            403,
            'INVALID_USER_ROLE',
            'The authenticated user has an invalid role'
        );
    }

    return {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        choirId: user.choirId ? user.choirId.toString() : null,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        sessionVersion: user.sessionVersion
    };
};

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
