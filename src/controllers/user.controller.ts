// src/controllers/user.controller.ts

import type { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import type { FilterQuery } from 'mongoose';
import { AppError } from '../errors/AppError';
import Theme from '../models/Theme';
import User, { type IUser } from '../models/User';
import type { RequestWithUser } from '../types/auth.types';
import { isUserRole } from '../types/roles.types';
import { registerLog } from '../utils/logger';
import {
    parseCreateUserInput,
    parseOptionalTemporaryPassword,
    parseUpdateProfileInput,
    parseUpdateUserInput,
    parseUserActiveStatus
} from '../validations/schemas/user.schemas';
import {
    parseObjectId,
    parsePagination,
    parseRequestBody,
    readOptionalString,
    readQueryString
} from '../validations/schemas/common.schemas';
import {
    createTenantUser,
    deleteTenantUser,
    findTenantUserById,
    resetTenantUserPassword,
    serializeUser,
    setTenantUserActiveStatus,
    updateOwnProfile,
    updateTenantUser,
    USER_SAFE_PROJECTION
} from '../services/user.service';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';

interface UserParams {
    readonly id: string;
}

const getCurrentUserDocument = async (req: RequestWithUser) => {
    const currentUserId = requireAuthenticatedUserId(req);
    const user = await User.findById(currentUserId);

    if (!user) {
        throw new AppError(
            404,
            'USER_NOT_FOUND',
            'The authenticated user no longer exists'
        );
    }

    return user;
};

const destroyPreviousImage = async (
    publicId: string | null | undefined
): Promise<void> => {
    if (publicId) {
        await cloudinary.uploader.destroy(publicId);
    }
};

export const getOwnProfileController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const user = await getCurrentUserDocument(req);
    res.json({ user: serializeUser(user) });
};

export const updateOwnPushTokenController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const user = await getCurrentUserDocument(req);
    const token = readOptionalString(parseRequestBody(req), 'token');
    user.pushToken = token || null;
    await user.save();
    res.json({ success: true });
};

export const updateOwnThemeController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const user = await getCurrentUserDocument(req);
    const themeIdValue = readOptionalString(parseRequestBody(req), 'themeId');

    if (!themeIdValue) {
        user.themeId = null;
        await user.save();
        res.json({ user: serializeUser(user) });
        return;
    }

    const themeId = parseObjectId(themeIdValue, 'themeId');
    const theme = await Theme.findOne({ _id: themeId, choirId }).select('_id');

    if (!theme) {
        throw new AppError(
            404,
            'THEME_NOT_FOUND',
            'The selected theme was not found in this choir'
        );
    }

    user.themeId = theme._id;
    await user.save();
    res.json({ user: serializeUser(user) });
};

export const updateOwnProfileController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const user = await getCurrentUserDocument(req);
    const input = parseUpdateProfileInput(req);

    if (req.file) {
        await destroyPreviousImage(user.imagePublicId);
        user.imageUrl = req.file.path;
        user.imagePublicId = req.file.filename;
    }

    const updatedUser = await updateOwnProfile(user, input);
    res.json({ user: serializeUser(updatedUser) });
};

export const searchUsersController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const query = readQueryString(req.query.q);

    if (!query) {
        throw new AppError(400, 'SEARCH_QUERY_REQUIRED', 'q is required');
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');
    const users = await User.find({
        choirId,
        isActive: true,
        $or: [{ name: regex }, { email: regex }, { username: regex }]
    })
        .select(USER_SAFE_PROJECTION)
        .sort({ name: 1 })
        .limit(50);

    res.json({ users: users.map(serializeUser) });
};

export const listDirectoryController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const users = await User.find({ choirId, isActive: true })
        .select('name username imageUrl role')
        .sort({ name: 1 });

    res.json({
        users: users.map((user) => ({
            id: user.id,
            name: user.name,
            username: user.username,
            imageUrl: user.imageUrl ?? '',
            role: user.role
        }))
    });
};

export const listUsersController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const page = readQueryString(req.query.page);
    const limit = readQueryString(req.query.limit);
    const pagination = parsePagination({ page, limit }, 10, 100);
    const filter: FilterQuery<IUser> = { choirId };
    const role = readQueryString(req.query.role);
    const activeQuery = readQueryString(req.query.isActive);

    if (role) {
        const normalizedRole = role.toUpperCase();

        if (!isUserRole(normalizedRole) || normalizedRole === 'SUPER_ADMIN') {
            throw new AppError(
                400,
                'INVALID_TENANT_ROLE',
                'role must be ADMIN, EDITOR, USER, or VIEWER'
            );
        }

        filter.role = normalizedRole;
    }

    if (activeQuery === 'true' || activeQuery === 'false') {
        filter.isActive = activeQuery === 'true';
    }

    const [users, totalUsers] = await Promise.all([
        User.find(filter)
            .select(USER_SAFE_PROJECTION)
            .sort({ name: 1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        User.countDocuments(filter)
    ]);

    res.json({
        users: users.map(serializeUser),
        currentPage: pagination.page,
        totalPages: Math.ceil(totalUsers / pagination.limit),
        totalUsers
    });
};

export const getUserController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const user = await findTenantUserById(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json({ user: serializeUser(user) });
};

export const createUserController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const { user, temporaryPassword } = await createTenantUser(
        parseCreateUserInput(req),
        requireEffectiveChoirObjectId(req),
        requireAuthenticatedUserId(req),
        req.file?.path ?? '',
        req.file?.filename ?? null
    );

    await registerLog({
        req,
        collection: 'Users',
        action: 'create',
        referenceId: user.id,
        changes: { after: serializeUser(user) }
    });

    res.status(201).json({
        message: 'User created successfully',
        user: serializeUser(user),
        temporaryPassword
    });
};

export const updateUserController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const user = await findTenantUserById(req.params.id, choirId);
    const before = serializeUser(user);

    if (req.file) {
        await destroyPreviousImage(user.imagePublicId);
        user.imageUrl = req.file.path;
        user.imagePublicId = req.file.filename;
    }

    const result = await updateTenantUser(
        user,
        parseUpdateUserInput(req),
        requireAuthenticatedUserId(req)
    );

    await registerLog({
        req,
        collection: 'Users',
        action: 'update',
        referenceId: user.id,
        changes: {
            before,
            after: serializeUser(result.user),
            sessionsRevoked: result.sessionsRevoked
        }
    });

    res.json({
        message: 'User updated successfully',
        user: serializeUser(result.user),
        sessionsRevoked: result.sessionsRevoked
    });
};

export const setUserActiveStatusController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const user = await findTenantUserById(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = serializeUser(user);
    const updatedUser = await setTenantUserActiveStatus(
        user,
        parseUserActiveStatus(req),
        requireAuthenticatedUserId(req)
    );

    await registerLog({
        req,
        collection: 'Users',
        action: 'update',
        referenceId: user.id,
        changes: { before, after: serializeUser(updatedUser) }
    });

    res.json({ user: serializeUser(updatedUser) });
};

export const resetUserPasswordController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const user = await findTenantUserById(
        req.params.id,
        requireEffectiveChoirObjectId(req),
        true
    );
    const temporaryPassword = await resetTenantUserPassword(
        user,
        parseOptionalTemporaryPassword(req),
        requireAuthenticatedUserId(req)
    );

    await registerLog({
        req,
        collection: 'Users',
        action: 'update',
        referenceId: user.id,
        changes: {
            passwordReset: true,
            mustChangePassword: true,
            sessionsRevoked: true
        }
    });

    res.json({
        message: 'Temporary password created successfully',
        temporaryPassword
    });
};

export const deleteUserController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const actorUserId = requireAuthenticatedUserId(req);
    const user = await findTenantUserById(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );

    if (
        user._id.equals(actorUserId) &&
        req.headers['x-confirm-self-delete'] !== 'DELETE_MY_ACCOUNT'
    ) {
        throw new AppError(
            409,
            'SELF_DELETE_CONFIRMATION_REQUIRED',
            'Self-deletion requires x-confirm-self-delete: DELETE_MY_ACCOUNT'
        );
    }

    const before = serializeUser(user);
    const imagePublicId = user.imagePublicId;
    await deleteTenantUser(user);
    await destroyPreviousImage(imagePublicId);

    await registerLog({
        req,
        collection: 'Users',
        action: 'delete',
        referenceId: user.id,
        changes: { before, sessionsRevoked: true }
    });

    res.json({ message: 'User deleted successfully' });
};
