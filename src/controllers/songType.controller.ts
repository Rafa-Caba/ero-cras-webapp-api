// src/controllers/songType.controller.ts

import type { Response } from 'express';
import { AppError } from '../errors/AppError';
import Song from '../models/Song';
import SongType, { type ISongType } from '../models/SongType';
import { sendCacheableJson } from '../services/httpCache.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseSongTypeInput } from '../validations/schemas/resource.schemas';

interface SongTypeParams {
    readonly id: string;
}

interface SongTypeResponse {
    readonly id: string;
    readonly name: string;
    readonly order: number;
    readonly parentId: string | null;
    readonly isParent: boolean;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

const serializeSongType = (songType: ISongType): SongTypeResponse => ({
    id: songType.id,
    name: songType.name,
    order: songType.order,
    parentId: songType.parentId?.toString() ?? null,
    isParent: songType.isParent,
    createdAt: songType.createdAt,
    updatedAt: songType.updatedAt
});

const findSongType = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<ISongType> => {
    return SongType
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'SONG_TYPE_NOT_FOUND',
                'Song type not found'
            )
        )
        .exec();
};

export const listSongTypesController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const songTypes = await SongType.find({
        choirId: requireEffectiveChoirObjectId(req)
    }).sort({ order: 1, name: 1 });

    sendCacheableJson(req, res, songTypes.map(serializeSongType));
};

export const getSongTypeController = async (
    req: RequestWithUser & { params: SongTypeParams },
    res: Response
): Promise<void> => {
    const songType = await findSongType(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(serializeSongType(songType));
};

export const createSongTypeController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseSongTypeInput(req);
    const songType = await SongType.create({
        ...input,
        parentId: input.parentId
            ? parseObjectId(input.parentId, 'parentId')
            : null,
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

    await registerLog({
        req,
        collection: 'SongTypes',
        action: 'create',
        referenceId: songType.id,
        changes: { after: songType.toObject() }
    });

    res.status(201).json(serializeSongType(songType));
};

export const updateSongTypeController = async (
    req: RequestWithUser & { params: SongTypeParams },
    res: Response
): Promise<void> => {
    const songType = await findSongType(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = songType.toObject();
    const input = parseSongTypeInput(req);

    songType.name = input.name;
    songType.order = input.order;

    if (input.parentId !== undefined) {
        songType.parentId = input.parentId
            ? parseObjectId(input.parentId, 'parentId')
            : null;
    }

    songType.isParent = input.isParent;
    songType.updatedBy = requireAuthenticatedUserId(req);
    await songType.save();

    await registerLog({
        req,
        collection: 'SongTypes',
        action: 'update',
        referenceId: songType.id,
        changes: { before, after: songType.toObject() }
    });

    res.json(serializeSongType(songType));
};

export const deleteSongTypeController = async (
    req: RequestWithUser & { params: SongTypeParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const songType = await findSongType(req.params.id, choirId);
    const references = await Promise.all([
        Song.exists({ choirId, songTypeId: songType._id }),
        SongType.exists({ choirId, parentId: songType._id })
    ]);

    if (references.some(Boolean)) {
        throw new AppError(
            409,
            'SONG_TYPE_IN_USE',
            'The song type cannot be deleted while it is referenced'
        );
    }

    const before = songType.toObject();
    await songType.deleteOne();

    await registerLog({
        req,
        collection: 'SongTypes',
        action: 'delete',
        referenceId: songType.id,
        changes: { before }
    });

    res.json({ message: 'Song type deleted successfully' });
};
