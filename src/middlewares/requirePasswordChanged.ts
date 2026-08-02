// src/middlewares/requirePasswordChanged.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';

export const requirePasswordChanged = (
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

    if (req.user.mustChangePassword) {
        throw new AppError(
            403,
            'PASSWORD_CHANGE_REQUIRED',
            'The temporary password must be changed before accessing this resource'
        );
    }

    next();
};
