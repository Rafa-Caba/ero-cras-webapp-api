import express, { Request, Response } from 'express';
import { Types } from 'mongoose';

import SongType from '../models/SongType';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import { applyPopulateAuthors, applyPopulateSingleAuthor } from '../utils/populateHelpers';

const router = express.Router();

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

/**
 * PUBLIC ENDPOINT
 */
router.get('/public', async (req: Request, res: Response): Promise<void> => {
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

        const types = await SongType.find(filter).sort({ order: 1 });

        res.json({ types });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving public song types',
            error: err.message
        });
    }
});

// ADMIN LIST 
router.get('/', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const { all, page, limit, choirId, choirKey } = req.query as {
            all?: string;
            page?: string;
            limit?: string;
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

        if (all === 'true' || !page) {
            const queryTypes = SongType.find(filter).sort({ order: 1 });
            const types = await applyPopulateAuthors(queryTypes);
            res.json({ types, totalTypes: types.length });
            return;
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 6;
        const skip = (pageNum - 1) * limitNum;

        const totalTypes = await SongType.countDocuments(filter);
        const totalPages = Math.ceil(totalTypes / limitNum);

        const queryTypes = SongType.find(filter)
            .sort({ order: 1 })
            .skip(skip)
            .limit(limitNum);

        const types = await applyPopulateAuthors(queryTypes);

        res.json({
            types,
            currentPage: pageNum,
            totalPages
        });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving song types',
            error: err.message
        });
    }
});

// GET ONE 
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        const typeDoc = await applyPopulateSingleAuthor(SongType.findById(id));

        if (!typeDoc) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        const type: any =
            typeof (typeDoc as any).toJSON === 'function'
                ? (typeDoc as any).toJSON()
                : typeDoc;

        if (
            user?.role !== 'SUPER_ADMIN' &&
            user?.choirId &&
            type.choirId &&
            type.choirId.toString() !== user.choirId.toString()
        ) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        res.json(type);
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving song type',
            error: err.message
        });
    }
});

// CREATE 
router.post(
    '/',
    verifyToken,
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = req.user;

            const name = req.body.name || req.body.nombre;
            const order = req.body.order ?? req.body.orden;

            let parentId = req.body.parentId || null;
            const isParent = req.body.isParent === true || req.body.isParent === 'true';

            if (!name) {
                res.status(400).json({ message: 'Name is required' });
                return;
            }

            let targetChoirId: string | null = null;

            if (user?.role === 'SUPER_ADMIN') {
                if (req.body.choirId) {
                    targetChoirId = req.body.choirId;
                } else if (req.body.choirKey) {
                    targetChoirId = await resolveChoirIdFromKey(req.body.choirKey);
                } else if (user.choirId) {
                    targetChoirId = user.choirId;
                }
            } else if (user?.choirId) {
                targetChoirId = user.choirId;
            }

            if (parentId === '' || parentId === 'undefined') {
                parentId = null;
            }

            const existing = await SongType.findOne({
                name: name,
                parentId: parentId || null,
                choirId: targetChoirId || null
            });

            if (existing) {
                res.status(409).json({
                    message: 'A song type with this name already exists in this folder for this choir.'
                });
                return;
            }

            const newType = new SongType({
                name,
                order: order ?? 0,
                parentId: parentId || null,
                isParent,
                choirId: targetChoirId || null,
                createdBy: req.body.createdBy
            });

            await newType.save();

            if (!newType.id) {
                res.status(201).json(newType);
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'SongTypes',
                action: 'create',
                referenceId: newType.id.toString(),
                changes: { new: newType.toJSON() }
            });

            res.status(201).json(newType.toJSON());
        } catch (err: any) {
            res.status(500).json({
                message: 'Error creating song type',
                error: err.message
            });
        }
    }
);

// UPDATE 
router.put(
    '/:id',
    verifyToken,
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const user = req.user;

            let type = await SongType.findById(id);
            if (!type) {
                res.status(404).json({ message: 'Song type not found' });
                return;
            }

            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                type.choirId &&
                type.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Song type not found' });
                return;
            }

            if (user?.role === 'SUPER_ADMIN') {
                if (req.body.choirId) {
                    type.choirId = req.body.choirId;
                } else if (req.body.choirKey) {
                    const resolved = await resolveChoirIdFromKey(req.body.choirKey);
                    if (resolved) {
                        type.choirId = resolved as any;
                    }
                }
            }

            const name = req.body.name || req.body.nombre;
            const order = req.body.order ?? req.body.orden;

            let parentId = req.body.parentId;
            if (parentId === '' || parentId === 'undefined') parentId = null;

            const isParent = req.body.isParent;

            if (name) {
                const existing = await SongType.findOne({
                    name: name,
                    parentId: parentId || null,
                    choirId: type.choirId || null
                });

                if (existing && existing.id.toString() !== id) {
                    res.status(409).json({
                        message: 'A song type with this name already exists in this folder for this choir.'
                    });
                    return;
                }
            }

            if (name) type.name = name;
            if (order !== undefined) type.order = order;
            if (parentId !== undefined) type.parentId = parentId || null;
            if (isParent !== undefined) type.isParent = isParent;

            type.updatedBy = req.body.updatedBy;

            const updatedType = await type.save();

            await registerLog({
                req: req as any,
                collection: 'SongTypes',
                action: 'update',
                referenceId: updatedType.id.toString(),
                changes: { after: updatedType.toJSON() }
            });

            res.json(updatedType.toJSON());
        } catch (err: any) {
            res.status(500).json({
                message: 'Error updating song type',
                error: err.message
            });
        }
    }
);

// DELETE 
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        const type = await SongType.findById(id);

        if (!type) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        if (
            user?.role !== 'SUPER_ADMIN' &&
            user?.choirId &&
            type.choirId &&
            type.choirId.toString() !== user.choirId.toString()
        ) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        await SongType.findByIdAndDelete(id);

        await registerLog({
            req: req as any,
            collection: 'SongTypes',
            action: 'delete',
            referenceId: type.id.toString(),
            changes: { deleted: type.toJSON() }
        });

        res.json({ message: 'Song type deleted successfully' });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error deleting song type',
            error: err.message
        });
    }
});

export default router;
