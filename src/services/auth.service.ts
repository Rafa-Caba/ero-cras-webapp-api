// src/services/auth.service.ts

import bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import Choir, { IChoir, normalizeChoirCode } from '../models/Choir';
import PlatformState from '../models/PlatformState';
import RefreshToken from '../models/RefreshToken';
import User, { IUser, normalizeUserIdentifier } from '../models/User';
import type {
    AuthSessionResponse,
    AuthenticatedChoir,
    AuthenticatedContext,
    AuthenticatedUser
} from '../types/auth.types';
import type {
    BootstrapSuperAdminInput,
    ChangePasswordInput,
    PlatformLoginInput,
    TenantLoginInput
} from '../validations/schemas/auth.schemas';
import {
    createSessionTokenPair,
    hashRefreshToken,
    verifyRefreshToken
} from './token.service';
import { disconnectUserSockets } from './socketRegistry.service';
import { unregisterAllUserPushDevices } from './pushDevice.service';

const BOOTSTRAP_PLATFORM_ACCOUNT_KEY = 'bootstrap-super-admin';
const PASSWORD_HASH_ROUNDS = 12;

export const serializeAuthenticatedUser = (
    user: IUser
): AuthenticatedUser => {
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
    user: IUser,
    choir: IChoir | null
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
        user: serializeAuthenticatedUser(user),
        choir: choir ? serializeChoir(choir) : null,
        requiresPasswordChange: user.mustChangePassword
    };
};

const loadActiveChoir = async (
    choirId: string
): Promise<IChoir> => {
    const choir = await Choir.findOne({ _id: choirId, isActive: true });

    if (!choir) {
        throw new AppError(
            403,
            'CHOIR_INACTIVE',
            'The user choir is missing or inactive'
        );
    }

    return choir;
};

const loadSessionChoir = async (user: IUser): Promise<IChoir | null> => {
    if (user.role === 'SUPER_ADMIN') {
        if (user.choirId) {
            throw new AppError(
                403,
                'INVALID_PLATFORM_CONTEXT',
                'A SUPER_ADMIN account cannot have a choir assignment'
            );
        }

        return null;
    }

    if (!user.choirId) {
        throw new AppError(
            403,
            'CHOIR_CONTEXT_REQUIRED',
            'The user does not have a valid choir context'
        );
    }

    return loadActiveChoir(user.choirId.toString());
};

const verifyUserPassword = async (
    password: string,
    user: IUser | null
): Promise<IUser> => {
    if (!user) {
        throw new AppError(
            401,
            'INVALID_CREDENTIALS',
            'The provided credentials are invalid'
        );
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
        throw new AppError(
            401,
            'INVALID_CREDENTIALS',
            'The provided credentials are invalid'
        );
    }

    if (!user.isActive) {
        throw new AppError(
            403,
            'USER_INACTIVE',
            'The user account is inactive'
        );
    }

    return user;
};

const recordSuccessfulLogin = async (user: IUser): Promise<void> => {
    const lastAccess = new Date();
    user.lastAccess = lastAccess;

    await User.updateOne(
        { _id: user._id },
        { $set: { lastAccess } }
    );
};

export const loginTenantUser = async (
    input: TenantLoginInput
): Promise<AuthSessionResponse> => {
    const choir = await Choir.findOne({
        code: normalizeChoirCode(input.choirCode),
        isActive: true
    });

    if (!choir) {
        throw new AppError(
            401,
            'INVALID_CREDENTIALS',
            'The provided credentials are invalid'
        );
    }

    const identifier = normalizeUserIdentifier(input.identifier);
    const userDocument = await User.findOne({
        choirId: choir._id,
        role: { $ne: 'SUPER_ADMIN' },
        $or: [
            { emailNormalized: identifier },
            { usernameNormalized: identifier }
        ]
    }).select('+password');

    const user = await verifyUserPassword(input.password, userDocument);
    await recordSuccessfulLogin(user);

    return createSessionResponse(user, choir);
};

export const loginPlatformUser = async (
    input: PlatformLoginInput
): Promise<AuthSessionResponse> => {
    const identifier = normalizeUserIdentifier(input.identifier);
    const userDocument = await User.findOne({
        role: 'SUPER_ADMIN',
        choirId: null,
        $or: [
            { emailNormalized: identifier },
            { usernameNormalized: identifier }
        ]
    }).select('+password');

    const user = await verifyUserPassword(input.password, userDocument);
    await recordSuccessfulLogin(user);

    return createSessionResponse(user, null);
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

    if (platformState?.superAdminBootstrapCompletedAt || existingSuperAdmin) {
        throw new AppError(
            409,
            'BOOTSTRAP_ALREADY_COMPLETED',
            'The initial SUPER_ADMIN has already been created'
        );
    }

    const passwordHash = await bcrypt.hash(
        input.password,
        PASSWORD_HASH_ROUNDS
    );

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

    return createSessionResponse(superAdmin, null);
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
        { $set: { revokedAt: new Date() } },
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
        user.sessionVersion !== claims.sv
    ) {
        throw new AppError(
            401,
            'SESSION_REVOKED',
            'The user session is no longer valid'
        );
    }

    const choir = await loadSessionChoir(user);
    const newSession = await createSessionResponse(user, choir);

    storedToken.replacedByTokenHash = hashRefreshToken(
        newSession.refreshToken
    );
    await storedToken.save();

    return newSession;
};

export const changeAuthenticatedPassword = async (
    userId: string,
    input: ChangePasswordInput
): Promise<AuthSessionResponse> => {
    const user = await User.findById(userId).select('+password');

    if (!user || !user.isActive) {
        throw new AppError(
            401,
            'SESSION_REVOKED',
            'The user session is no longer valid'
        );
    }

    const currentPasswordMatches = await bcrypt.compare(
        input.currentPassword,
        user.password
    );

    if (!currentPasswordMatches) {
        throw new AppError(
            401,
            'INVALID_CURRENT_PASSWORD',
            'The current password is invalid'
        );
    }

    const passwordIsUnchanged = await bcrypt.compare(
        input.newPassword,
        user.password
    );

    if (passwordIsUnchanged) {
        throw new AppError(
            409,
            'PASSWORD_REUSE_NOT_ALLOWED',
            'The new password must be different from the current password'
        );
    }

    user.password = await bcrypt.hash(
        input.newPassword,
        PASSWORD_HASH_ROUNDS
    );
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.sessionVersion += 1;
    await user.save();

    await RefreshToken.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
    await unregisterAllUserPushDevices(
        user._id,
        'User password changed'
    );

    disconnectUserSockets(
        user._id.toString(),
        'PASSWORD_CHANGED',
        'The password changed and the previous socket session was closed'
    );

    const choir = await loadSessionChoir(user);
    return createSessionResponse(user, choir);
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
        { $set: { revokedAt: new Date() } }
    );
};

export const buildCurrentSessionResponse = (
    context: AuthenticatedContext
): {
    readonly user: AuthenticatedUser;
    readonly choir: AuthenticatedChoir | null;
    readonly targetChoir: AuthenticatedChoir | null;
    readonly effectiveChoirId: string | null;
    readonly requiresPasswordChange: boolean;
} => {
    return {
        user: context.user,
        choir: context.choir,
        targetChoir: context.targetChoir,
        effectiveChoirId: context.effectiveChoirId,
        requiresPasswordChange: context.user.mustChangePassword
    };
};
