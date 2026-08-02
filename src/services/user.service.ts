// src/services/user.service.ts

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import { parseObjectId } from '../validations/schemas/common.schemas';
import User, { type IUser } from '../models/User';
import type {
    CreateUserInput,
    TenantUserRole,
    UpdateProfileInput,
    UpdateUserInput,
    UserResponse
} from '../types/user.types';
import { revokeAllUserSessions } from './session.service';

const PASSWORD_SALT_ROUNDS = 12;

export const USER_SAFE_PROJECTION = [
    'name',
    'username',
    'email',
    'role',
    'imageUrl',
    'instrumentId',
    'instrumentLabel',
    'voice',
    'bio',
    'themeId',
    'choirId',
    'isActive',
    'mustChangePassword',
    'lastAccess',
    'createdAt',
    'updatedAt'
].join(' ');

export const serializeUser = (user: IUser): UserResponse => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    imageUrl: user.imageUrl ?? '',
    instrumentId: user.instrumentId?.toString() ?? null,
    instrumentLabel: user.instrumentLabel ?? '',
    voice: user.voice,
    bio: user.bio ?? '',
    themeId: user.themeId?.toString() ?? null,
    choirId: user.choirId?.toString() ?? null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastAccess: user.lastAccess ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null
});

export const generateTemporaryPassword = (): string => {
    return `${randomBytes(9).toString('base64url')}Aa1!`;
};

const assertAdminRemains = async (
    user: IUser,
    nextRole: TenantUserRole | undefined,
    nextIsActive: boolean | undefined
): Promise<void> => {
    if (user.role !== 'ADMIN' || !user.isActive) {
        return;
    }

    const removesActiveAdmin =
        (nextRole !== undefined && nextRole !== 'ADMIN') ||
        nextIsActive === false;

    if (!removesActiveAdmin || !user.choirId) {
        return;
    }

    const activeAdminCount = await User.countDocuments({
        choirId: user.choirId,
        role: 'ADMIN',
        isActive: true
    });

    if (activeAdminCount <= 1) {
        throw new AppError(
            409,
            'LAST_ACTIVE_ADMIN_REQUIRED',
            'The last active ADMIN of a choir cannot be removed or suspended'
        );
    }
};

export const findTenantUserById = async (
    userId: string,
    choirId: Types.ObjectId,
    includePassword = false
): Promise<IUser> => {
    const query = User.findOne({
        _id: parseObjectId(userId, 'userId'),
        choirId
    });

    if (includePassword) {
        query.select('+password');
    }

    const user = await query;

    if (!user) {
        throw new AppError(
            404,
            'USER_NOT_FOUND',
            'The requested user was not found in the selected choir'
        );
    }

    return user;
};

export const createTenantUser = async (
    input: CreateUserInput,
    choirId: Types.ObjectId,
    actorUserId: Types.ObjectId,
    imageUrl: string,
    imagePublicId: string | null
): Promise<{ readonly user: IUser; readonly temporaryPassword: string }> => {
    const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(
        temporaryPassword,
        PASSWORD_SALT_ROUNDS
    );

    const user = await User.create({
        name: input.name,
        username: input.username,
        email: input.email,
        password: hashedPassword,
        role: input.role,
        instrumentId: input.instrumentId
            ? parseObjectId(input.instrumentId, 'instrumentId')
            : null,
        instrumentLabel: input.instrumentLabel ?? '',
        voice: input.voice,
        bio: input.bio ?? '',
        imageUrl,
        imagePublicId,
        choirId,
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        sessionVersion: 1,
        createdBy: actorUserId
    });

    return { user, temporaryPassword };
};

export const updateTenantUser = async (
    user: IUser,
    input: UpdateUserInput,
    actorUserId: Types.ObjectId
): Promise<{ readonly user: IUser; readonly sessionsRevoked: boolean }> => {
    await assertAdminRemains(user, input.role, undefined);
    const roleChanged = input.role !== undefined && input.role !== user.role;

    if (input.name !== undefined) user.name = input.name;
    if (input.username !== undefined) user.username = input.username;
    if (input.email !== undefined) user.email = input.email;
    if (input.role !== undefined) user.role = input.role;
    if (input.instrumentId !== undefined) {
        user.instrumentId = input.instrumentId
            ? parseObjectId(input.instrumentId, 'instrumentId')
            : null;
    }
    if (input.instrumentLabel !== undefined) {
        user.instrumentLabel = input.instrumentLabel;
    }
    if (input.voice !== undefined) user.voice = input.voice;
    if (input.bio !== undefined) user.bio = input.bio;

    user.updatedBy = actorUserId;
    await user.save();

    if (roleChanged) {
        await revokeAllUserSessions(user._id);
    }

    return { user, sessionsRevoked: roleChanged };
};

export const updateOwnProfile = async (
    user: IUser,
    input: UpdateProfileInput
): Promise<IUser> => {
    if (input.name !== undefined) user.name = input.name;
    if (input.username !== undefined) user.username = input.username;
    if (input.email !== undefined) user.email = input.email;
    if (input.instrumentId !== undefined) {
        user.instrumentId = input.instrumentId
            ? parseObjectId(input.instrumentId, 'instrumentId')
            : null;
    }
    if (input.instrumentLabel !== undefined) {
        user.instrumentLabel = input.instrumentLabel;
    }
    if (input.voice !== undefined) user.voice = input.voice;
    if (input.bio !== undefined) user.bio = input.bio;

    await user.save();
    return user;
};

export const setTenantUserActiveStatus = async (
    user: IUser,
    isActive: boolean,
    actorUserId: Types.ObjectId
): Promise<IUser> => {
    await assertAdminRemains(user, undefined, isActive);
    const statusChanged = user.isActive !== isActive;
    user.isActive = isActive;
    user.updatedBy = actorUserId;
    await user.save();

    if (statusChanged) {
        await revokeAllUserSessions(user._id);
    }

    return user;
};

export const resetTenantUserPassword = async (
    user: IUser,
    requestedPassword: string | undefined,
    actorUserId: Types.ObjectId
): Promise<string> => {
    const temporaryPassword = requestedPassword ?? generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);
    user.mustChangePassword = true;
    user.passwordChangedAt = new Date();
    user.updatedBy = actorUserId;
    await user.save();
    await revokeAllUserSessions(user._id);
    return temporaryPassword;
};

export const deleteTenantUser = async (user: IUser): Promise<void> => {
    await assertAdminRemains(user, undefined, false);
    await revokeAllUserSessions(user._id);
    await User.deleteOne({ _id: user._id, choirId: user.choirId });
};
