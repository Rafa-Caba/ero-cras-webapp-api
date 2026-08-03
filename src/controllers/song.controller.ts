// src/controllers/song.controller.ts

import type { Response } from 'express';
import Song, { type ISong } from '../models/Song';
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
        .orFail(() =>
            createTenantResourceNotFoundError(
                'SONG_NOT_FOUND',
                'Song not found'
            )
        )
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
    const song = await Song.create({
        ...input,
        songTypeId: input.songTypeId
            ? parseObjectId(input.songTypeId, 'songTypeId')
            : null,
        audioUrl: req.file?.path ?? '',
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

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
    const song = await findSong(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = song.toObject();
    const input = parseSongInput(req);

    song.title = input.title;
    song.composer = input.composer;
    song.content = input.content;
    song.songTypeId = input.songTypeId
        ? parseObjectId(input.songTypeId, 'songTypeId')
        : null;

    if (req.file) {
        song.audioUrl = req.file.path;
    }

    song.updatedBy = requireAuthenticatedUserId(req);
    await song.save();

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
    const song = await findSong(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = song.toObject();
    await song.deleteOne();

    await registerLog({
        req,
        collection: 'Songs',
        action: 'delete',
        referenceId: song.id,
        changes: { before }
    });

    res.json({ message: 'Song deleted successfully' });
};
