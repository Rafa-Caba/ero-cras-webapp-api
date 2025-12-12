import express, { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';

import verifyToken, { RequestWithUser } from '../middlewares/auth';
import Song from '../models/Song';
import Choir from '../models/Choir';
import '../models/SongType';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import {
    applyPopulateAuthors,
    applyPopulateSingleAuthor
} from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import { uploadSongAudio } from '../middlewares/cloudinaryStorage';

const router = express.Router();

const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error('Error parsing JSON from mobile:', e);
        }
    }
    return body;
};

const resolveChoirIdFromKey = async (choirKey?: string | null): Promise<string | null> => {
    if (!choirKey) return null;

    if (Types.ObjectId.isValid(choirKey)) {
        return choirKey;
    }

    const choir = await Choir.findOne({
        $or: [{ code: choirKey }, { name: choirKey }]
    }).select('_id');

    return choir ? (choir as any).id : null;
};

const normalizeSong = (doc: any) => {
    if (!doc) return doc;

    const obj =
        typeof doc.toJSON === 'function'
            ? doc.toJSON()
            : typeof doc.toObject === 'function'
                ? doc.toObject({ virtuals: true, versionKey: false })
                : { ...doc };

    if (obj._id && !obj.id) {
        obj.id = obj._id.toString();
    }
    delete obj._id;

    const rawType = obj.songTypeId;

    if (rawType) {
        if (typeof rawType === 'object') {
            const typeId =
                rawType._id?.toString?.() ??
                rawType.id?.toString?.() ??
                String(rawType);

            obj.songTypeId = typeId;
            obj.songTypeName = rawType.name ?? obj.songTypeName ?? '';
        } else {
            obj.songTypeId = rawType.toString();
        }
    } else {
        obj.songTypeId = null;
        obj.songTypeName = obj.songTypeName ?? '';
    }

    // Normalize choirId to string (if populated)
    if (obj.choirId && typeof obj.choirId === 'object' && obj.choirId.toString) {
        obj.choirId = obj.choirId.toString();
    }

    return obj;
};

// PUBLIC ENDPOINT 
router.get(
    '/public',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { choirId, choirKey } = req.query as {
                choirId?: string;
                choirKey?: string;
            };

            const filter: any = {};

            if (choirId) {
                filter.choirId = choirId;
            } else if (choirKey) {
                const resolved = await resolveChoirIdFromKey(choirKey);
                if (resolved) {
                    filter.choirId = resolved;
                }
            }

            const query = Song.find(filter)
                .sort({ createdAt: -1 })
                .populate('songTypeId', 'name order')
                .populate('createdBy', 'name username');

            const docs = await query;
            const songs = docs.map(normalizeSong);

            res.json(songs);
        } catch (error: any) {
            console.error('Error retrieving public songs:', error);
            res.status(500).json({ message: 'Error retrieving public songs' });
        }
    }
);

// CREATE
router.post(
    '/',
    verifyToken,
    uploadSongAudio.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const user = req.user;

            const { title, content, composer, songTypeId } = body;

            let audioUrl = body.audioUrl;
            if (req.file) {
                audioUrl = req.file.path;
            }

            if (!title || !content) {
                res.status(400).json({
                    message: 'Title and Content are required'
                });
                return;
            }

            let targetChoirId: string | null = null;

            if (user?.role === 'SUPER_ADMIN') {
                if (body.choirId) {
                    targetChoirId = body.choirId;
                } else if (body.choirKey) {
                    targetChoirId = await resolveChoirIdFromKey(body.choirKey);
                } else if (user.choirId) {
                    targetChoirId = user.choirId;
                }
            } else if (user?.choirId) {
                targetChoirId = user.choirId;
            }

            const newSong = new Song({
                title,
                content,
                composer,
                songTypeId: songTypeId || null,
                audioUrl,
                choirId: targetChoirId || null,
                createdBy: req.body.createdBy
            });

            await newSong.save();

            if (!newSong.id) {
                res.status(201).json({
                    message: 'Song created successfully',
                    song: normalizeSong(newSong)
                });
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'Songs',
                action: 'create',
                referenceId: newSong.id.toString(),
                changes: { new: newSong.toJSON() }
            });

            res.status(201).json({
                message: 'Song created successfully',
                song: normalizeSong(newSong)
            });
        } catch (error: any) {
            console.error('Create Song Error:', error);
            res.status(500).json({
                message: 'Error creating song',
                error: error.message
            });
        }
    }
);

// ADMIN LIST 
router.get(
    '/',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = req.user;
            const { choirId, choirKey } = req.query as {
                choirId?: string;
                choirKey?: string;
            };

            const filter: any = {};

            if (user?.role !== 'SUPER_ADMIN') {
                if (user?.choirId) {
                    filter.choirId = user.choirId;
                }
            } else {
                if (choirId) {
                    filter.choirId = choirId;
                } else if (choirKey) {
                    const resolved = await resolveChoirIdFromKey(choirKey);
                    if (resolved) {
                        filter.choirId = resolved;
                    }
                } else if (user?.choirId) {
                    filter.choirId = user.choirId;
                }
            }

            const query = Song.find(filter).populate('songTypeId', 'name order');
            const docs = await applyPopulateAuthors(query);

            const songs = docs.map(normalizeSong);

            res.json(songs);
        } catch (error: any) {
            console.error('Error retrieving songs:', error);
            res.status(500).json({ message: 'Error retrieving songs' });
        }
    }
);

// GET ONE 
router.get(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response, _next: NextFunction): Promise<void> => {
        try {
            const user = req.user;

            const doc = await applyPopulateSingleAuthor(
                Song.findById(req.params.id).populate('songTypeId', 'name order')
            );

            if (!doc) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            const songObj = normalizeSong(doc);

            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                songObj.choirId &&
                songObj.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            res.json(songObj);
        } catch (error: any) {
            console.error('Error retrieving song:', error);
            res.status(500).json({
                message: 'Error retrieving song',
                error: error.message
            });
        }
    }
);

// UPDATE 
router.put(
    '/:id',
    verifyToken,
    uploadSongAudio.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const body = parseBody(req);
            const user = req.user;

            const { title, content, composer, songTypeId } = body;

            const song = await Song.findById(id);
            if (!song) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                song.choirId &&
                song.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            if (user?.role === 'SUPER_ADMIN') {
                if (body.choirId) {
                    song.choirId = body.choirId;
                } else if (body.choirKey) {
                    const resolved = await resolveChoirIdFromKey(body.choirKey);
                    if (resolved) {
                        song.choirId = resolved as any;
                    }
                }
            }

            if (req.file) {
                song.audioUrl = req.file.path;
            }

            if (title !== undefined) song.title = title;
            if (content !== undefined) song.content = content;
            if (composer !== undefined) song.composer = composer;
            if (songTypeId !== undefined) song.songTypeId = songTypeId || null;

            song.updatedBy = req.body.updatedBy;

            await song.save();

            await registerLog({
                req: req as any,
                collection: 'Songs',
                action: 'update',
                referenceId: song.id.toString(),
                changes: { updated: song.toJSON() }
            });

            const reloaded = await Song.findById(song.id)
                .populate('songTypeId', 'name order')
                .populate('createdBy', 'name username')
                .populate('updatedBy', 'name username');

            res.json(normalizeSong(reloaded));
        } catch (error: any) {
            console.error('Error updating song:', error);
            res.status(500).json({
                message: 'Error updating song',
                error: error.message
            });
        }
    }
);

// DELETE 
router.delete(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = req.user;
            const song = await Song.findById(req.params.id);

            if (!song) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                song.choirId &&
                song.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            await Song.findByIdAndDelete(req.params.id);

            await registerLog({
                req: req as any,
                collection: 'Songs',
                action: 'delete',
                referenceId: song.id.toString(),
                changes: { deleted: song.toJSON() }
            });

            res.json({ message: 'Song deleted successfully' });
        } catch (error: any) {
            console.error('Error deleting song:', error);
            res.status(500).json({ message: error.message });
        }
    }
);

export default router;
