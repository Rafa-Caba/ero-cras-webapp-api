// src/middlewares/requireRole.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';
import type { UserRole } from '../types/roles.types';

export const requireRole = (...allowedRoles: readonly UserRole[]) => {
    return (
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

        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError(
                403,
                'INSUFFICIENT_ROLE',
                'The authenticated user does not have the required role'
            );
        }

        next();
    };
};
