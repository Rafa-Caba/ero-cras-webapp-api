// src/middlewares/requireTenantContext.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';

export const requireTenantContext = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    if (!req.auth?.effectiveChoirId) {
        throw new AppError(
            403,
            'TENANT_CONTEXT_REQUIRED',
            'A valid choir context is required for this operation'
        );
    }

    next();
};
