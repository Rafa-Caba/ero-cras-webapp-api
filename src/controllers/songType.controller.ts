// src/controllers/songType.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import Song from '../models/Song';
import SongType, { type ISongType } from '../models/SongType';
import { resolvePublicChoirId } from '../services/publicChoir.service';
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
    readonly choirKey?: string;
}

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

export const listPublicSongTypesController = async (
    req: Request<SongTypeParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const songTypes = await SongType.find({ choirId })
        .select('-createdBy -updatedBy')
        .sort({ order: 1, name: 1 });
    res.json(songTypes);
};

export const listSongTypesController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const songTypes = await SongType.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('parentId', 'name order')
        .sort({ order: 1, name: 1 });
    res.json(songTypes);
};

export const getSongTypeController = async (
    req: RequestWithUser & { params: SongTypeParams },
    res: Response
): Promise<void> => {
    const songType = await findSongType(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    await songType.populate('parentId', 'name order');
    res.json(songType);
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

    res.status(201).json(songType);
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
    songType.parentId = input.parentId
        ? parseObjectId(input.parentId, 'parentId')
        : null;
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

    res.json(songType);
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
