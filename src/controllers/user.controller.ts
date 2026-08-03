// src/controllers/user.controller.ts

import type { Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { AppError } from '../errors/AppError';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
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


const uploadProfileImage = async (
    file: Express.Multer.File,
    choirId: Types.ObjectId | null | undefined,
    actorUserId: Types.ObjectId
): ReturnType<typeof uploadTenantMedia> => {
    if (!choirId) {
        throw new AppError(
            403,
            'CHOIR_CONTEXT_REQUIRED',
            'A tenant profile image requires a choir context'
        );
    }

    return uploadTenantMedia({
        file,
        choirId,
        actorUserId,
        ownerType: 'USER',
        category: 'users'
    });
};

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

export const getOwnProfileController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const user = await getCurrentUserDocument(req);
    res.json({ user: serializeUser(user) });
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
    const previousAssetId = user.imageAssetId;
    const uploaded = req.file
        ? await uploadProfileImage(req.file, user.choirId, user._id)
        : null;

    if (uploaded) {
        user.imageUrl = uploaded.media.url;
        user.imagePublicId = uploaded.media.publicId;
        user.imageResourceType = uploaded.media.resourceType;
        user.imageAssetId = uploaded.asset._id;
    }

    const updatedUser = await updateOwnProfile(user, input).catch(
        async (error: Error) => {
            if (uploaded) {
                await discardPendingMedia(
                    uploaded.asset._id,
                    uploaded.asset.choirId,
                    'Profile update failed'
                );
            }
            throw error;
        }
    );

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            uploaded.asset.choirId,
            'USER',
            user._id
        );
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId: uploaded.asset.choirId,
            ownerType: 'USER',
            ownerId: user._id
        });
    }

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
    const input = parseCreateUserInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'USER',
            category: 'users'
        })
        : null;
    const result = await createTenantUser(
        input,
        choirId,
        actorUserId,
        uploaded?.media.url ?? '',
        uploaded?.media.publicId ?? null,
        uploaded?.media.resourceType ?? null,
        uploaded?.asset._id ?? null
    ).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'User creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'USER',
            result.user._id
        );
    }

    await registerLog({
        req,
        collection: 'Users',
        action: 'create',
        referenceId: result.user.id,
        changes: { after: serializeUser(result.user) }
    });

    res.status(201).json({
        message: 'User created successfully',
        user: serializeUser(result.user),
        temporaryPassword: result.temporaryPassword
    });
};

export const updateUserController = async (
    req: RequestWithUser & { params: UserParams },
    res: Response
): Promise<void> => {
    const input = parseUpdateUserInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const user = await findTenantUserById(req.params.id, choirId);
    const before = serializeUser(user);
    const previousAssetId = user.imageAssetId;
    const uploaded = req.file && choirId
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'USER',
            category: 'users'
        })
        : null;

    if (uploaded) {
        user.imageUrl = uploaded.media.url;
        user.imagePublicId = uploaded.media.publicId;
        user.imageResourceType = uploaded.media.resourceType;
        user.imageAssetId = uploaded.asset._id;
    }

    const result = await updateTenantUser(
        user,
        input,
        actorUserId
    ).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'User update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'USER', user._id);
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'USER',
            ownerId: user._id
        });
    }

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
    const imageAssetId = user.imageAssetId;
    await deleteTenantUser(user);
    await deleteOwnedMedia({
        assetId: imageAssetId,
        choirId: requireEffectiveChoirObjectId(req),
        ownerType: 'USER',
        ownerId: user._id
    });

    await registerLog({
        req,
        collection: 'Users',
        action: 'delete',
        referenceId: user.id,
        changes: { before, sessionsRevoked: true }
    });

    res.json({ message: 'User deleted successfully' });
};
