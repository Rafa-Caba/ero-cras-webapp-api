// src/services/token.service.ts

import { createHash, randomUUID } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type {
    AccessTokenClaims,
    RefreshTokenClaims,
    SessionTokenPair
} from '../types/auth.types';

export interface SessionTokenSubject {
    readonly userId: string;
    readonly sessionVersion: number;
}

const isAccessTokenClaims = (
    payload: string | JwtPayload
): payload is AccessTokenClaims => {
    return (
        typeof payload !== 'string' &&
        typeof payload.sub === 'string' &&
        /^[a-f0-9]{24}$/i.test(payload.sub) &&
        typeof payload.sv === 'number' &&
        Number.isInteger(payload.sv) &&
        payload.sv > 0 &&
        payload.typ === 'access' &&
        typeof payload.jti === 'string' &&
        payload.jti.length > 0
    );
};

const isRefreshTokenClaims = (
    payload: string | JwtPayload
): payload is RefreshTokenClaims => {
    return (
        typeof payload !== 'string' &&
        typeof payload.sub === 'string' &&
        /^[a-f0-9]{24}$/i.test(payload.sub) &&
        typeof payload.sv === 'number' &&
        Number.isInteger(payload.sv) &&
        payload.sv > 0 &&
        payload.typ === 'refresh' &&
        typeof payload.jti === 'string' &&
        payload.jti.length > 0
    );
};

export const hashRefreshToken = (token: string): string => {
    return createHash('sha256').update(token).digest('hex');
};

export const createSessionTokenPair = (
    subject: SessionTokenSubject
): SessionTokenPair => {
    const accessTokenId = randomUUID();
    const refreshTokenId = randomUUID();

    const accessToken = jwt.sign(
        {
            sub: subject.userId,
            sv: subject.sessionVersion,
            typ: 'access',
            jti: accessTokenId
        },
        env.jwt.accessSecret,
        {
            expiresIn: env.jwt.accessExpiresInSeconds,
            issuer: env.jwt.issuer,
            audience: env.jwt.audience
        }
    );

    const refreshToken = jwt.sign(
        {
            sub: subject.userId,
            sv: subject.sessionVersion,
            typ: 'refresh',
            jti: refreshTokenId
        },
        env.jwt.refreshSecret,
        {
            expiresIn: env.jwt.refreshExpiresInSeconds,
            issuer: env.jwt.issuer,
            audience: env.jwt.audience
        }
    );

    return {
        accessToken,
        refreshToken,
        refreshTokenId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        refreshTokenExpiresAt: new Date(
            Date.now() + env.jwt.refreshExpiresInSeconds * 1000
        )
    };
};

export const verifyAccessToken = (token: string): AccessTokenClaims => {
    try {
        const payload = jwt.verify(token, env.jwt.accessSecret, {
            issuer: env.jwt.issuer,
            audience: env.jwt.audience
        });

        if (!isAccessTokenClaims(payload)) {
            throw new AppError(
                401,
                'INVALID_ACCESS_TOKEN',
                'The access token payload is invalid'
            );
        }

        return payload;
    } catch {
        throw new AppError(
            401,
            'INVALID_ACCESS_TOKEN',
            'The access token is expired or invalid'
        );
    }
};

export const verifyRefreshToken = (token: string): RefreshTokenClaims => {
    try {
        const payload = jwt.verify(token, env.jwt.refreshSecret, {
            issuer: env.jwt.issuer,
            audience: env.jwt.audience
        });

        if (!isRefreshTokenClaims(payload)) {
            throw new AppError(
                401,
                'INVALID_REFRESH_TOKEN',
                'The refresh token payload is invalid'
            );
        }

        return payload;
    } catch {
        throw new AppError(
            401,
            'INVALID_REFRESH_TOKEN',
            'The refresh token is expired or invalid'
        );
    }
};
