// src/middlewares/authenticate.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';
import { verifyAccessToken } from '../services/token.service';

export const authenticate = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        throw new AppError(
            401,
            'ACCESS_TOKEN_REQUIRED',
            'An Authorization bearer token is required'
        );
    }

    const [scheme, token, extraPart] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token || extraPart) {
        throw new AppError(
            401,
            'INVALID_AUTHORIZATION_HEADER',
            'Authorization must use the Bearer token format'
        );
    }

    req.authToken = verifyAccessToken(token);
    next();
};
