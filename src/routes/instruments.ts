// src/routes/instruments.ts
import express, { Request, Response } from 'express';
import Instrument from '../models/Instrument';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import {
    applyPopulateAuthors,
    applyPopulateSingleAuthor
} from '../utils/populateHelpers';
import {
    uploadInstrumentIcon,
    deleteFromCloudinary
} from '../middlewares/cloudinaryStorage';

const router = express.Router();

/**
 * Utility: parse body in case mobile sends JSON as "data" string
 */
const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error('Error parsing JSON from mobile (instruments):', e);
        }
    }
    return body;
};

/**
 * PUBLIC LIST
 * GET /api/instruments/public
 */
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
    try {
        const instruments = await Instrument.find({ isActive: true }).sort({
            order: 1,
            name: 1
        });

        res.json(instruments.map((i) => i.toJSON()));
    } catch (err: any) {
        console.error('Error retrieving public instruments:', err);
        res.status(500).json({
            message: 'Error retrieving instruments',
            error: err.message
        });
    }
});

/**
 * ADMIN LIST
 * GET /api/instruments
 */
router.get(
    '/',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (!currentUser) {
                res.status(401).json({ message: 'Not authenticated' });
                return;
            }

            const query = Instrument.find().sort({ order: 1, name: 1 });
            const instruments = await applyPopulateAuthors(query);

            res.json(instruments.map((i: any) => i.toJSON()));
        } catch (err: any) {
            console.error('Error retrieving instruments:', err);
            res.status(500).json({
                message: 'Error retrieving instruments',
                error: err.message
            });
        }
    }
);

/**
 * GET ONE
 * GET /api/instruments/:id
 */
router.get(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const instrument = await applyPopulateSingleAuthor(
                Instrument.findById(id)
            );

            if (!instrument) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

            res.json(instrument.toJSON());
        } catch (err: any) {
            console.error('Error retrieving instrument:', err);
            res.status(500).json({
                message: 'Error retrieving instrument',
                error: err.message
            });
        }
    }
);

/**
 * CREATE INSTRUMENT
 * POST /api/instruments
 */
router.post(
    '/',
    verifyToken,
    uploadInstrumentIcon.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (
                !currentUser ||
                (currentUser.role !== 'ADMIN' &&
                    currentUser.role !== 'SUPER_ADMIN')
            ) {
                res.status(403).json({
                    message:
                        'Solo ADMIN o SUPER_ADMIN pueden crear instrumentos'
                });
                return;
            }

            const body = parseBody(req as unknown as Request);
            const { name, slug, category, iconKey, isActive, order } = body;

            if (!name || !slug || !iconKey) {
                res.status(400).json({
                    message:
                        'name, slug y iconKey son campos requeridos para crear un instrumento'
                });
                return;
            }

            const normalizedSlug = String(slug).trim().toLowerCase();
            const existing = await Instrument.findOne({ slug: normalizedSlug });
            if (existing) {
                res.status(409).json({
                    message: 'Ya existe un instrumento con ese slug'
                });
                return;
            }

            let iconUrl = '';
            let iconPublicId: string | null = null;

            if (req.file) {
                iconUrl = (req.file as any).path;
                iconPublicId = (req.file as any).filename;
            }

            const instrument = new Instrument({
                name: String(name).trim(),
                slug: normalizedSlug,
                category: category ? String(category).trim() : 'other',
                iconKey: String(iconKey).trim(),
                isActive:
                    typeof isActive === 'boolean'
                        ? isActive
                        : isActive !== undefined
                            ? Boolean(isActive)
                            : true,
                order:
                    typeof order === 'number'
                        ? order
                        : Number(order) || 0,

                iconUrl,
                iconPublicId,

                createdBy: (req.body as any).createdBy
            });

            await instrument.save();

            await registerLog({
                req,
                collection: 'Instruments',
                action: 'create',
                referenceId: instrument.id.toString(),
                changes: { new: instrument.toJSON() }
            });

            res.status(201).json({
                message: 'Instrument created successfully',
                instrument: instrument.toJSON()
            });
        } catch (err: any) {
            console.error('Error creating instrument:', err);
            res.status(500).json({
                message: 'Error creating instrument',
                error: err.message
            });
        }
    }
);

/**
 * UPDATE INSTRUMENT
 * PUT /api/instruments/:id
 */
router.put(
    '/:id',
    verifyToken,
    uploadInstrumentIcon.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (
                !currentUser ||
                (currentUser.role !== 'ADMIN' &&
                    currentUser.role !== 'SUPER_ADMIN')
            ) {
                res.status(403).json({
                    message:
                        'Solo ADMIN o SUPER_ADMIN pueden actualizar instrumentos'
                });
                return;
            }

            const { id } = req.params;
            const body = parseBody(req as unknown as Request);
            const { name, slug, category, iconKey, isActive, order } = body;

            const instrument = await Instrument.findById(id);
            if (!instrument) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

            if (slug && slug !== instrument.slug) {
                const normalizedSlug = String(slug).trim().toLowerCase();
                const existing = await Instrument.findOne({
                    slug: normalizedSlug
                });
                if (existing && existing.id.toString() !== id) {
                    res.status(409).json({
                        message: 'Ya existe un instrumento con ese slug'
                    });
                    return;
                }
                instrument.slug = normalizedSlug;
            }

            if (name !== undefined) instrument.name = String(name).trim();
            if (category !== undefined)
                instrument.category = String(category).trim();
            if (iconKey !== undefined)
                instrument.iconKey = String(iconKey).trim();
            if (isActive !== undefined)
                instrument.isActive = Boolean(isActive);
            if (order !== undefined)
                instrument.order =
                    typeof order === 'number'
                        ? order
                        : Number(order) || 0;

            if (req.file) {
                if (instrument.iconPublicId) {
                    await deleteFromCloudinary(instrument.iconPublicId, 'image');
                }

                instrument.iconUrl = (req.file as any).path;
                instrument.iconPublicId = (req.file as any).filename;
            }

            instrument.updatedBy = (req.body as any).updatedBy;

            await instrument.save();

            await registerLog({
                req,
                collection: 'Instruments',
                action: 'update',
                referenceId: instrument.id.toString(),
                changes: { updated: instrument.toJSON() }
            });

            res.json({
                message: 'Instrument updated successfully',
                instrument: instrument.toJSON()
            });
        } catch (err: any) {
            console.error('Error updating instrument:', err);
            res.status(500).json({
                message: 'Error updating instrument',
                error: err.message
            });
        }
    }
);

/**
 * DELETE INSTRUMENT
 * DELETE /api/instruments/:id
 */
router.delete(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (
                !currentUser ||
                (currentUser.role !== 'ADMIN' &&
                    currentUser.role !== 'SUPER_ADMIN')
            ) {
                res.status(403).json({
                    message:
                        'Solo ADMIN o SUPER_ADMIN pueden eliminar instrumentos'
                });
                return;
            }

            const { id } = req.params;

            const instrument = await Instrument.findById(id);
            if (!instrument) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

            if (instrument.iconPublicId) {
                await deleteFromCloudinary(instrument.iconPublicId, 'image');
            }

            await Instrument.findByIdAndDelete(id);

            await registerLog({
                req,
                collection: 'Instruments',
                action: 'delete',
                referenceId: instrument.id.toString(),
                changes: { deleted: instrument.toJSON() }
            });

            res.json({ message: 'Instrument deleted successfully' });
        } catch (err: any) {
            console.error('Error deleting instrument:', err);
            res.status(500).json({
                message: 'Error deleting instrument',
                error: err.message
            });
        }
    }
);

export default router;
