import express, { NextFunction, Request, Response } from "express";
import verifyToken, { RequestWithUser } from "../middlewares/auth";
import Song from "../models/Song";
import "../models/SongType";
import { setUpdatedBy, setCreatedBy } from "../utils/setCreatedBy";
import {
    applyPopulateAuthors,
    applyPopulateSingleAuthor
} from "../utils/populateHelpers";
import { registerLog } from "../utils/logger";
import { uploadSongAudio } from "../middlewares/cloudinaryStorage";

const router = express.Router();

/**
 * Helper: Parse Request Body (supports { data: JSON } from mobile / multipart)
 */
const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === "string") {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error("Error parsing JSON from mobile:", e);
        }
    }
    return body;
};

const normalizeSong = (doc: any) => {
    if (!doc) return doc;

    const obj =
        typeof doc.toJSON === "function"
            ? doc.toJSON()
            : typeof doc.toObject === "function"
                ? doc.toObject({ virtuals: true, versionKey: false })
                : { ...doc };

    if (obj._id && !obj.id) {
        obj.id = obj._id.toString();
    }
    delete obj._id;

    const rawType = obj.songTypeId;

    if (rawType) {
        if (typeof rawType === "object") {
            const typeId =
                rawType._id?.toString?.() ??
                rawType.id?.toString?.() ??
                String(rawType);

            obj.songTypeId = typeId;
            obj.songTypeName = rawType.name ?? obj.songTypeName ?? "";
        } else {
            obj.songTypeId = rawType.toString();
        }
    } else {
        obj.songTypeId = null;
        obj.songTypeName = obj.songTypeName ?? "";
    }

    return obj;
};

// PUBLIC ENDPOINT - List all songs
router.get(
    "/public",
    async (_req: Request, res: Response): Promise<void> => {
        try {
            const docs = await Song.find()
                .sort({ createdAt: -1 })
                .populate("songTypeId", "name order")
                .populate("createdBy", "name username");

            const songs = docs.map(normalizeSong);

            res.json(songs);
        } catch (error: any) {
            console.error("Error retrieving public songs:", error);
            res.status(500).json({ message: "Error retrieving public songs" });
        }
    }
);

// CREATE
router.post(
    "/",
    verifyToken,
    uploadSongAudio.single("file"),
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
                res.status(400).json({
                    message: "Title and Content are required"
                });
                return;
            }

            const newSong = new Song({
                title,
                content,
                composer,
                songTypeId: songTypeId || null,
                audioUrl,
                createdBy: req.body.createdBy
            });

            await newSong.save();

            if (!newSong._id) return;

            await registerLog({
                req: req as any,
                collection: "Songs",
                action: "create",
                referenceId: newSong._id.toString(),
                changes: { new: newSong }
            });

            res
                .status(201)
                .json({ message: "Song created successfully", song: normalizeSong(newSong) });
        } catch (error: any) {
            console.error("Create Song Error:", error);
            res.status(500).json({
                message: "Error creating song",
                error: error.message
            });
        }
    }
);

// ADMIN LIST - All songs
router.get(
    "/",
    verifyToken,
    async (_req: Request, res: Response): Promise<void> => {
        try {
            const docs = await applyPopulateAuthors(
                Song.find().populate("songTypeId", "name order")
            );

            const songs = docs.map(normalizeSong);

            res.json(songs);
        } catch (error: any) {
            console.error("Error retrieving songs:", error);
            res.status(500).json({ message: "Error retrieving songs" });
        }
    }
);

// GET ONE
router.get(
    "/:id",
    verifyToken,
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        try {
            const doc = await applyPopulateSingleAuthor(
                Song.findById(req.params.id).populate("songTypeId", "name order")
            );

            if (!doc) {
                res.status(404).json({ message: "Song not found" });
                return;
            }

            const song = normalizeSong(doc);

            res.json(song);
        } catch (error: any) {
            console.error("Error retrieving song:", error);
            res.status(500).json({
                message: "Error retrieving song",
                error: error.message
            });
        }
    }
);

// UPDATE
router.put(
    "/:id",
    verifyToken,
    uploadSongAudio.single("file"),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const body = parseBody(req);

            const { title, content, composer, songTypeId } = body;

            const song = await Song.findById(id);
            if (!song) {
                res.status(404).json({ message: "Song not found" });
                return;
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
                collection: "Songs",
                action: "update",
                referenceId: song.id.toString(),
                changes: { updated: song }
            });

            const reloaded = await Song.findById(song.id)
                .populate("songTypeId", "name order")
                .populate("createdBy", "name username")
                .populate("updatedBy", "name username");

            res.json(normalizeSong(reloaded));
        } catch (error: any) {
            console.error("Error updating song:", error);
            res
                .status(500)
                .json({ message: "Error updating song", error: error.message });
        }
    }
);

// DELETE
router.delete(
    "/:id",
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const song = await Song.findById(req.params.id);
            if (!song) {
                res.status(404).json({ message: "Song not found" });
                return;
            }

            await Song.findByIdAndDelete(req.params.id);

            await registerLog({
                req: req as any,
                collection: "Songs",
                action: "delete",
                referenceId: song.id.toString(),
                changes: { deleted: song }
            });

            res.json({ message: "Song deleted successfully" });
        } catch (error: any) {
            console.error("Error deleting song:", error);
            res.status(500).json({ message: error.message });
        }
    }
);

export default router;
