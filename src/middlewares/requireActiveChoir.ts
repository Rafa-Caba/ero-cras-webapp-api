// src/middlewares/requireActiveChoir.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import Choir from '../models/Choir';
import { serializeChoir } from '../services/auth.service';
import type { RequestWithUser } from '../types/auth.types';

export const requireActiveChoir = async (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user || !req.auth) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated context has not been initialized'
        );
    }

    if (req.user.role === 'SUPER_ADMIN') {
        if (req.user.choirId) {
            throw new AppError(
                403,
                'INVALID_PLATFORM_CONTEXT',
                'A SUPER_ADMIN account cannot have a choir assignment'
            );
        }

        next();
        return;
    }

    if (!req.user.choirId) {
        throw new AppError(
            403,
            'CHOIR_CONTEXT_REQUIRED',
            'The authenticated user does not have a choir assignment'
        );
    }

    const choir = await Choir.findById(req.user.choirId);

    if (!choir || !choir.isActive) {
        throw new AppError(
            403,
            'CHOIR_INACTIVE',
            'The authenticated user choir is missing or inactive'
        );
    }

    req.auth = {
        ...req.auth,
        choir: serializeChoir(choir),
        effectiveChoirId: choir.id
    };

    next();
};
