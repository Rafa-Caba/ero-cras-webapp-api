// src/services/choir.service.ts

import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import { AppError } from '../errors/AppError';
import Choir, { IChoir } from '../models/Choir';
import type { AuthenticatedUser } from '../types/auth.types';
import type {
    CreateChoirInput,
    UpdateChoirInput
} from '../validations/schemas/choir.schemas';
import {
    createDefaultThemesForChoir,
    ensureDefaultSettingsForChoir
} from './choirDefaults.service';
import { disconnectChoirSockets } from './socketRegistry.service';
import { unregisterChoirPushDevices } from './pushDevice.service';
import type { MediaResourceType } from '../types/media.types';

export interface UploadedChoirLogo {
    readonly url: string;
    readonly publicId: string;
    readonly resourceType: MediaResourceType;
    readonly assetId: Types.ObjectId;
}

export interface PaginatedChoirs {
    readonly choirs: readonly IChoir[];
    readonly currentPage: number;
    readonly totalPages: number;
    readonly totalChoirs: number;
}

const buildChoirVisibilityFilter = (
    currentUser: AuthenticatedUser
): FilterQuery<IChoir> => {
    if (currentUser.role === 'SUPER_ADMIN') {
        return {};
    }

    if (!currentUser.choirId) {
        throw new AppError(
            403,
            'CHOIR_CONTEXT_REQUIRED',
            'The authenticated user does not have a choir assignment'
        );
    }

    return { _id: currentUser.choirId };
};

const ensureUniqueChoirCode = async (
    code: string,
    excludedChoirId?: string
): Promise<void> => {
    const filter: FilterQuery<IChoir> = { code };

    if (excludedChoirId) {
        filter._id = { $ne: new Types.ObjectId(excludedChoirId) };
    }

    const existingChoir = await Choir.exists(filter);

    if (existingChoir) {
        throw new AppError(
            409,
            'CHOIR_CODE_ALREADY_EXISTS',
            'A choir with the same code already exists'
        );
    }
};

export const listVisibleChoirs = async (
    currentUser: AuthenticatedUser,
    page: number,
    limit = 10
): Promise<PaginatedChoirs> => {
    const filter = buildChoirVisibilityFilter(currentUser);
    const skip = (page - 1) * limit;

    const [choirs, totalChoirs] = await Promise.all([
        Choir.find(filter)
            .populate('createdBy', 'name username')
            .populate('updatedBy', 'name username')
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit),
        Choir.countDocuments(filter)
    ]);

    return {
        choirs,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalChoirs / limit)),
        totalChoirs
    };
};

export const getVisibleChoirById = async (
    currentUser: AuthenticatedUser,
    choirId: string
): Promise<IChoir> => {
    const visibilityFilter = buildChoirVisibilityFilter(currentUser);
    const choir = await Choir.findOne({
        $and: [
            visibilityFilter,
            { _id: new Types.ObjectId(choirId) }
        ]
    })
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');

    if (!choir) {
        throw new AppError(
            404,
            'CHOIR_NOT_FOUND',
            'The requested choir was not found'
        );
    }

    return choir;
};

export const createChoir = async (
    choirId: Types.ObjectId,
    input: CreateChoirInput,
    actorUserId: string,
    uploadedLogo?: UploadedChoirLogo
): Promise<IChoir> => {
    await ensureUniqueChoirCode(input.code);

    const choir = await Choir.create({
        _id: choirId,
        ...input,
        logoUrl: uploadedLogo?.url ?? '',
        logoPublicId: uploadedLogo?.publicId ?? null,
        logoResourceType: uploadedLogo?.resourceType ?? null,
        logoAssetId: uploadedLogo?.assetId ?? null,
        createdBy: new Types.ObjectId(actorUserId)
    });

    await Promise.all([
        createDefaultThemesForChoir(choir._id),
        ensureDefaultSettingsForChoir(choir._id)
    ]);

    return choir;
};

export const updateChoir = async (
    choirId: string,
    input: UpdateChoirInput,
    actorUserId: string,
    uploadedLogo?: UploadedChoirLogo
): Promise<IChoir> => {
    const choir = await Choir.findById(choirId);

    if (!choir) {
        throw new AppError(
            404,
            'CHOIR_NOT_FOUND',
            'The requested choir was not found'
        );
    }

    const wasActive = choir.isActive;

    if (input.code && input.code !== choir.code) {
        await ensureUniqueChoirCode(input.code, choirId);
        choir.code = input.code;
    }

    if (input.name !== undefined) {
        choir.name = input.name;
    }

    if (input.description !== undefined) {
        choir.description = input.description;
    }

    if (input.isActive !== undefined) {
        choir.isActive = input.isActive;
    }

    if (uploadedLogo) {
        choir.logoUrl = uploadedLogo.url;
        choir.logoPublicId = uploadedLogo.publicId;
        choir.logoResourceType = uploadedLogo.resourceType;
        choir.logoAssetId = uploadedLogo.assetId;
    }

    choir.updatedBy = new Types.ObjectId(actorUserId);
    await choir.save();

    if (wasActive && !choir.isActive) {
        await unregisterChoirPushDevices(
            choir._id,
            'Choir deactivated'
        );
        disconnectChoirSockets(
            choir._id.toString(),
            'CHOIR_DEACTIVATED',
            'The choir was deactivated and all active socket sessions were closed'
        );
    }

    return choir;
};

export const deactivateChoir = async (
    choirId: string,
    actorUserId: string
): Promise<IChoir> => {
    const choir = await Choir.findById(choirId);

    if (!choir) {
        throw new AppError(
            404,
            'CHOIR_NOT_FOUND',
            'The requested choir was not found'
        );
    }

    choir.isActive = false;
    choir.updatedBy = new Types.ObjectId(actorUserId);
    await choir.save();

    await unregisterChoirPushDevices(
        choir._id,
        'Choir deactivated'
    );

    disconnectChoirSockets(
        choir._id.toString(),
        'CHOIR_DEACTIVATED',
        'The choir was deactivated and all active socket sessions were closed'
    );

    return choir;
};
