import express, { Request, Response } from 'express';
import { Types } from 'mongoose';

import Instrument from '../models/Instrument';
import Choir from '../models/Choir';
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

const buildPublicFilter = async (req: Request): Promise<any> => {
    const { choirId, choirKey } = req.query as {
        choirId?: string;
        choirKey?: string;
    };
    const choirKeyParam = (req.params as any).choirKey as string | undefined;

    const filter: any = { isActive: true };

    let resolvedChoirId: string | null = null;

    if (choirId) {
        resolvedChoirId = choirId;
    } else if (choirKey) {
        resolvedChoirId = await resolveChoirIdFromKey(choirKey);
    } else if (choirKeyParam) {
        resolvedChoirId = await resolveChoirIdFromKey(choirKeyParam);
    }

    if (resolvedChoirId) {
        filter.choirId = resolvedChoirId;
    }

    return filter;
};

const buildAdminFilter = async (req: RequestWithUser): Promise<any> => {
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

    return filter;
};

/**
 * PUBLIC LIST
 * GET /api/instruments/public
 */
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const filter = await buildPublicFilter(req);

        const instruments = await Instrument.find(filter).sort({
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
 * PUBLIC LIST BY choirKey
 * GET /api/instruments/public/:choirKey
 */
router.get('/public/:choirKey', async (req: Request, res: Response): Promise<void> => {
    try {
        const filter = await buildPublicFilter(req);

        const instruments = await Instrument.find(filter).sort({
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

            const filter = await buildAdminFilter(req);

            const query = Instrument.find(filter).sort({ order: 1, name: 1 });
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
            const user = req.user;

            const instrumentDoc = await Instrument.findById(id);
            if (!instrumentDoc) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

            // Choir scoping: non-SUPER_ADMIN only sees instruments from their choir
            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                instrumentDoc.choirId &&
                instrumentDoc.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

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

            // Resolve target choirId (SUPER_ADMIN can override via body.choirId / body.choirKey)
            let targetChoirId: string | null = null;

            if (currentUser.role === 'SUPER_ADMIN') {
                if (body.choirId) {
                    targetChoirId = body.choirId;
                } else if (body.choirKey) {
                    targetChoirId = await resolveChoirIdFromKey(body.choirKey);
                } else if (currentUser.choirId) {
                    targetChoirId = currentUser.choirId;
                }
            } else if (currentUser.choirId) {
                targetChoirId = currentUser.choirId;
            }

            const normalizedSlug = String(slug).trim().toLowerCase();
            const existing = await Instrument.findOne({
                slug: normalizedSlug,
                choirId: targetChoirId || null
            });
            if (existing) {
                res.status(409).json({
                    message: 'Ya existe un instrumento con ese slug en este coro'
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

                choirId: targetChoirId || null,
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

            // Choir scoping for non SUPER_ADMIN
            if (
                currentUser.role !== 'SUPER_ADMIN' &&
                currentUser.choirId &&
                instrument.choirId &&
                instrument.choirId.toString() !== currentUser.choirId.toString()
            ) {
                res.status(404).json({ message: 'Instrument not found' });
                return;
            }

            // SUPER_ADMIN can reassign choir via body.choirId / body.choirKey
            if (currentUser.role === 'SUPER_ADMIN') {
                let targetChoirId: string | null =
                    (instrument.choirId && instrument.choirId.toString()) || null;

                if (body.choirId) {
                    targetChoirId = body.choirId;
                } else if (body.choirKey) {
                    const resolved = await resolveChoirIdFromKey(body.choirKey);
                    if (resolved) {
                        targetChoirId = resolved;
                    }
                }

                instrument.choirId = targetChoirId as any;
            }

            if (slug && slug !== instrument.slug) {
                const normalizedSlug = String(slug).trim().toLowerCase();
                const existing = await Instrument.findOne({
                    slug: normalizedSlug,
                    choirId: instrument.choirId || null
                });
                if (existing && existing.id.toString() !== id) {
                    res.status(409).json({
                        message:
                            'Ya existe un instrumento con ese slug en este coro'
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

            if (
                currentUser.role !== 'SUPER_ADMIN' &&
                currentUser.choirId &&
                instrument.choirId &&
                instrument.choirId.toString() !== currentUser.choirId.toString()
            ) {
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
            res.status(500).json({ message: 'Error deleting instrument' });
        }
    }
);

export default router;
