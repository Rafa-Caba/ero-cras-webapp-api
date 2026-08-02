// src/middlewares/requireActiveUser.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';

export const requireActiveUser = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated user has not been loaded'
        );
    }

    if (!req.user.isActive) {
        throw new AppError(
            403,
            'USER_INACTIVE',
            'The authenticated user is inactive'
        );
    }

    next();
};
