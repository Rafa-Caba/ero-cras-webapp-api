// src/services/auth.service.ts

import bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import Choir, { IChoir } from '../models/Choir';
import PlatformState from '../models/PlatformState';
import RefreshToken from '../models/RefreshToken';
import User, { IUser } from '../models/User';
import type {
    AuthSessionResponse,
    AuthenticatedChoir,
    AuthenticatedContext,
    AuthenticatedUser
} from '../types/auth.types';
import { isUserRole } from '../types/roles.types';
import type { BootstrapSuperAdminInput } from '../validations/schemas/auth.schemas';
import {
    createSessionTokenPair,
    hashRefreshToken,
    verifyRefreshToken
} from './token.service';

const BOOTSTRAP_PLATFORM_ACCOUNT_KEY = 'bootstrap-super-admin';

const serializeUser = (user: IUser): AuthenticatedUser => {
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

export const serializeChoir = (choir: IChoir): AuthenticatedChoir => {
    return {
        id: choir._id.toString(),
        name: choir.name,
        code: choir.code,
        isActive: choir.isActive
    };
};

const compareSecrets = (provided: string, expected: string): boolean => {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
};

const persistRefreshToken = async (
    user: IUser,
    tokenId: string,
    tokenHash: string,
    expiresAt: Date
): Promise<void> => {
    await RefreshToken.create({
        tokenHash,
        tokenId,
        userId: user._id,
        sessionVersion: user.sessionVersion,
        expiresAt
    });
};

const createSessionResponse = async (
    user: IUser
): Promise<AuthSessionResponse> => {
    const tokenPair = createSessionTokenPair({
        userId: user._id.toString(),
        sessionVersion: user.sessionVersion
    });

    await persistRefreshToken(
        user,
        tokenPair.refreshTokenId,
        tokenPair.refreshTokenHash,
        tokenPair.refreshTokenExpiresAt
    );

    return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: serializeUser(user)
    };
};

export const bootstrapSuperAdmin = async (
    input: BootstrapSuperAdminInput,
    providedBootstrapToken: string
): Promise<AuthSessionResponse> => {
    if (!env.bootstrap.enabled || !env.bootstrap.token) {
        throw new AppError(
            404,
            'BOOTSTRAP_DISABLED',
            'The SUPER_ADMIN bootstrap endpoint is disabled'
        );
    }

    if (!compareSecrets(providedBootstrapToken, env.bootstrap.token)) {
        throw new AppError(
            401,
            'INVALID_BOOTSTRAP_TOKEN',
            'The bootstrap token is invalid'
        );
    }

    const platformState = await PlatformState.findOne({ key: 'platform' });
    const existingSuperAdmin = await User.exists({ role: 'SUPER_ADMIN' });

    if (
        platformState?.superAdminBootstrapCompletedAt ||
        existingSuperAdmin
    ) {
        throw new AppError(
            409,
            'BOOTSTRAP_ALREADY_COMPLETED',
            'The initial SUPER_ADMIN has already been created'
        );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const superAdmin = await User.create({
        name: input.name,
        username: input.username,
        usernameNormalized: input.username,
        email: input.email,
        emailNormalized: input.email,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        choirId: null,
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        sessionVersion: 1,
        platformAccountKey: BOOTSTRAP_PLATFORM_ACCOUNT_KEY
    });

    await PlatformState.findOneAndUpdate(
        { key: 'platform' },
        {
            $set: {
                superAdminBootstrapCompletedAt: new Date(),
                superAdminBootstrapUserId: superAdmin._id
            },
            $setOnInsert: { key: 'platform' }
        },
        { upsert: true, new: true }
    );

    return createSessionResponse(superAdmin);
};

export const refreshSession = async (
    refreshToken: string
): Promise<AuthSessionResponse> => {
    const claims = verifyRefreshToken(refreshToken);
    const tokenHash = hashRefreshToken(refreshToken);

    const storedToken = await RefreshToken.findOneAndUpdate(
        {
            tokenHash,
            tokenId: claims.jti,
            userId: claims.sub,
            sessionVersion: claims.sv,
            revokedAt: null,
            expiresAt: { $gt: new Date() }
        },
        {
            $set: { revokedAt: new Date() }
        },
        { new: true }
    ).select('+tokenHash');

    if (!storedToken) {
        throw new AppError(
            401,
            'REFRESH_TOKEN_REVOKED',
            'The refresh token is invalid, expired, or already used'
        );
    }

    const user = await User.findById(claims.sub);

    if (
        !user ||
        !user.isActive ||
        !isUserRole(user.role) ||
        user.sessionVersion !== claims.sv
    ) {
        throw new AppError(
            401,
            'SESSION_REVOKED',
            'The user session is no longer valid'
        );
    }

    if (user.role !== 'SUPER_ADMIN') {
        if (!user.choirId) {
            throw new AppError(
                403,
                'CHOIR_CONTEXT_REQUIRED',
                'The user does not have a valid choir context'
            );
        }

        const activeChoir = await Choir.exists({
            _id: user.choirId,
            isActive: true
        });

        if (!activeChoir) {
            throw new AppError(
                403,
                'CHOIR_INACTIVE',
                'The user choir is missing or inactive'
            );
        }
    }

    const newSession = await createSessionResponse(user);
    storedToken.replacedByTokenHash = hashRefreshToken(
        newSession.refreshToken
    );
    await storedToken.save();

    return newSession;
};

export const revokeRefreshToken = async (
    userId: string,
    refreshToken: string
): Promise<void> => {
    await RefreshToken.updateOne(
        {
            tokenHash: hashRefreshToken(refreshToken),
            userId,
            revokedAt: null
        },
        {
            $set: { revokedAt: new Date() }
        }
    );
};

export const buildCurrentSessionResponse = (
    context: AuthenticatedContext
): {
    readonly user: AuthenticatedUser;
    readonly choir: AuthenticatedChoir | null;
    readonly targetChoir: AuthenticatedChoir | null;
    readonly effectiveChoirId: string | null;
} => {
    return {
        user: context.user,
        choir: context.choir,
        targetChoir: context.targetChoir,
        effectiveChoirId: context.effectiveChoirId
    };
};
