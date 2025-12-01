import express, { NextFunction, Request, Response } from 'express';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import Song from '../models/Song';
import '../models/SongType'; // Ensure model is registered
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import { uploadSongAudio } from '../middlewares/cloudinaryStorage';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

/**
 * Helper: Parse Request Body
 */
const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error("Error parsing JSON from mobile:", e);
        }
    }
    return body;
};

// 🟣 PUBLIC ENDPOINT
router.get('/public', async (_req: Request, res: Response) => {
    try {
        const songs = await Song.find()
            .sort({ createdAt: -1 })
            .populate('songTypeId', 'name order')
            .populate('createdBy', 'name username');

        res.json(songs);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public songs' });
    }
});

// 🟣 CREATE
router.post('/',
    verifyToken,
    uploadSongAudio.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);

            const { title, content, composer, songTypeId } = body;

            let audioUrl = body.audioUrl;
            if (req.file) {
                audioUrl = req.file.path;
            }

            if (!title || !content) {
                res.status(400).json({ message: 'Title and Content are required' });
                return;
            }

            const newSong = new Song({
                title,
                content, // TipTap JSON
                composer,
                songTypeId: songTypeId || null,
                audioUrl,
                createdBy: req.body.createdBy
            });

            await newSong.save();

            if (!newSong._id) return;

            await registerLog({
                req: req as any,
                collection: 'Songs',
                action: 'create',
                referenceId: newSong._id.toString(),
                changes: { new: newSong }
            });

            res.status(201).json({ message: 'Song created successfully', song: newSong });
        } catch (error: any) {
            console.error("Create Song Error:", error);
            res.status(500).json({ message: 'Error creating song', error: error.message });
        }
    });

// 🟣 ADMIN ENDPOINT (All Songs)
router.get('/', verifyToken, async (_req: Request, res: Response) => {
    try {
        const songs = await applyPopulateAutores(
            Song.find().populate('songTypeId', 'name order')
        );
        res.json(songs);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving songs' });
    }
});

// 🟣 GET ONE
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const song = await applyPopulateAutorSingle(
            Song.findById(req.params.id).populate('songTypeId', 'name order')
        );
        if (!song) {
            res.status(404).json({ message: 'Song not found' });
            return;
        }
        res.json(song);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 UPDATE
router.put('/:id',
    verifyToken,
    uploadSongAudio.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const body = parseBody(req);

            const { title, content, composer, songTypeId } = body;

            const song = await Song.findById(id);
            if (!song) {
                res.status(404).json({ message: 'Song not found' });
                return;
            }

            // Handle Audio Replacement
            if (req.file) {
                song.audioUrl = req.file.path;
            }

            if (title) song.title = title;
            if (content) song.content = content;
            if (composer !== undefined) song.composer = composer;
            if (songTypeId !== undefined) song.songTypeId = songTypeId;

            song.updatedBy = req.body.updatedBy;

            await song.save();

            await registerLog({
                req: req as any,
                collection: 'Songs',
                action: 'update',
                referenceId: song.id.toString(),
                changes: { updated: song }
            });

            res.json(song);
        } catch (error: any) {
            console.error('Error updating song:', error);
            res.status(500).json({ message: 'Error updating song' });
        }
    });

// 🟣 DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song) {
            res.status(404).json({ message: 'Song not found' });
            return;
        }

        await Song.findByIdAndDelete(req.params.id);

        await registerLog({
            req: req as any,
            collection: 'Songs',
            action: 'delete',
            referenceId: song.id.toString(),
            changes: { deleted: song }
        });

        res.json({ message: 'Song deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;