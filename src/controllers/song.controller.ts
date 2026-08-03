// src/controllers/song.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import Song, { type ISong } from '../models/Song';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseSongInput } from '../validations/schemas/resource.schemas';

interface SongParams {
    readonly id: string;
}

const findSong = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<ISong> => {
    return Song
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'SONG_NOT_FOUND',
            'Song not found'
        ))
        .exec();
};

const populateSong = async (song: ISong): Promise<ISong> => {
    await song.populate([
        { path: 'songTypeId', select: 'name order' },
        { path: 'createdBy', select: 'name username' },
        { path: 'updatedBy', select: 'name username' }
    ]);
    return song;
};

export const listSongsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const songs = await Song.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('songTypeId', 'name order')
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username')
        .sort({ createdAt: -1 });
    res.json(songs);
};

export const getSongController = async (
    req: RequestWithUser & { params: SongParams },
    res: Response
): Promise<void> => {
    const song = await findSong(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(await populateSong(song));
};

export const createSongController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseSongInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const songId = new Types.ObjectId();
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'SONG',
            category: 'songs'
        })
        : null;

    const song = await Song.create({
        _id: songId,
        ...input,
        songTypeId: input.songTypeId
            ? parseObjectId(input.songTypeId, 'songTypeId')
            : null,
        audioUrl: uploaded?.media.url ?? '',
        audioPublicId: uploaded?.media.publicId ?? null,
        audioResourceType: uploaded?.media.resourceType ?? null,
        audioAssetId: uploaded?.asset._id ?? null,
        choirId,
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Song creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'SONG', song._id);
    }

    await registerLog({
        req,
        collection: 'Songs',
        action: 'create',
        referenceId: song.id,
        changes: { after: song.toObject() }
    });

    res.status(201).json(await populateSong(song));
};

export const updateSongController = async (
    req: RequestWithUser & { params: SongParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const song = await findSong(req.params.id, choirId);
    const before = song.toObject();
    const input = parseSongInput(req);
    const previousAssetId = song.audioAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'SONG',
            category: 'songs'
        })
        : null;

    song.title = input.title;
    song.composer = input.composer;
    song.content = input.content;
    song.songTypeId = input.songTypeId
        ? parseObjectId(input.songTypeId, 'songTypeId')
        : null;
    song.updatedBy = actorUserId;

    if (uploaded) {
        song.audioUrl = uploaded.media.url;
        song.audioPublicId = uploaded.media.publicId;
        song.audioResourceType = uploaded.media.resourceType;
        song.audioAssetId = uploaded.asset._id;
    }

    await song.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Song update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'SONG', song._id);
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'SONG',
            ownerId: song._id
        });
    }

    await registerLog({
        req,
        collection: 'Songs',
        action: 'update',
        referenceId: song.id,
        changes: { before, after: song.toObject() }
    });

    res.json(await populateSong(song));
};

export const deleteSongController = async (
    req: RequestWithUser & { params: SongParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const song = await findSong(req.params.id, choirId);
    const before = song.toObject();
    const assetId = song.audioAssetId;
    await song.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'SONG',
        ownerId: song._id
    });

    await registerLog({
        req,
        collection: 'Songs',
        action: 'delete',
        referenceId: song.id,
        changes: { before }
    });

    res.json({ message: 'Song deleted successfully' });
};
