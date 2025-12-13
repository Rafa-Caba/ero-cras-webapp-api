import express, { Request, Response } from 'express';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import {
    applyPopulateAuthors,
    applyPopulateSingleAuthor
} from '../utils/populateHelpers';
import { createDefaultThemesForChoir } from '../bootstrap/createDefaultThemesForChoir';
import { ensureDefaultSettingsForChoir } from '../bootstrap/ensureDefaultSettingsForChoir';
import { uploadChoirLogo } from '../middlewares/cloudinaryStorage';

const router = express.Router();

const parseBody = (req: Request) => {
    let body = req.body;

    // RN / mobile compat: JSON string in "data"
    if (req.body?.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error('Error parsing JSON from mobile:', e);
        }
    }

    return body || {};
};

// ---------- PUBLIC LIST ----------
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
    try {
        const choirs = await Choir.find({ isActive: true }).sort({ name: 1 });
        res.json(choirs.map((c) => c.toJSON()));
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving choirs', error: err.message });
    }
});

// ---------- ADMIN LIST (PAGINATED, choir-scoped for non SUPER_ADMIN) ----------
router.get('/', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const currentUser = req.user;
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const filter: any = {};

        // Non SUPER_ADMIN only sees their own choir
        if (currentUser?.role !== 'SUPER_ADMIN' && currentUser?.choirId) {
            filter._id = currentUser.choirId;
        }

        const totalChoirs = await Choir.countDocuments(filter);
        const query = Choir.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        const choirs = await applyPopulateAuthors(query);

        const totalPages = Math.max(1, Math.ceil(totalChoirs / limit));

        res.json({
            choirs: choirs.map((c: any) => c.toJSON()),
            currentPage: page,
            totalPages,
            totalChoirs
        });
    } catch (err: any) {
        console.error('Error retrieving choirs:', err);
        res.status(500).json({ message: 'Error retrieving choirs', error: err.message });
    }
});

// ---------- GET ONE (choir-scoped for non SUPER_ADMIN) ----------
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const choirDoc = await applyPopulateSingleAuthor(Choir.findById(id));

        if (!choirDoc) {
            res.status(404).json({ message: 'Choir not found' });
            return;
        }

        const choir: any =
            typeof (choirDoc as any).toJSON === 'function'
                ? (choirDoc as any).toJSON()
                : choirDoc;

        if (
            currentUser?.role !== 'SUPER_ADMIN' &&
            currentUser?.choirId &&
            choir.id &&
            choir.id.toString() !== currentUser.choirId.toString()
        ) {
            res.status(404).json({ message: 'Choir not found' });
            return;
        }

        res.json(choir);
    } catch (err: any) {
        console.error('Error retrieving choir:', err);
        res.status(500).json({ message: 'Error retrieving choir', error: err.message });
    }
});

// ---------- CREATE CHOIR (SUPER_ADMIN) + LOGO + DEFAULT THEMES/SETTINGS ----------
router.post(
    '/',
    verifyToken,
    uploadChoirLogo.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
                res.status(403).json({ message: 'Solo SUPER_ADMIN puede crear coros' });
                return;
            }

            const body = parseBody(req as unknown as Request);
            const { name, code, description } = body;

            if (!name || !code) {
                res.status(400).json({ message: 'Nombre y código son requeridos' });
                return;
            }

            const normalizedCode = String(code).trim().toLowerCase();

            const existing = await Choir.findOne({ code: normalizedCode });
            if (existing) {
                res.status(409).json({ message: 'Ya existe un coro con ese código' });
                return;
            }

            let isActive = true;
            if (typeof body.isActive === 'string') {
                isActive = body.isActive === 'true';
            } else if (typeof body.isActive === 'boolean') {
                isActive = body.isActive;
            }

            let logoUrl = '';
            let logoPublicId: string | null = null;

            if (req.file) {
                const file: any = req.file;
                logoUrl = file.path;
                logoPublicId = file.filename;
            }

            const choir = new Choir({
                name: String(name).trim(),
                code: normalizedCode,
                description: description || '',
                isActive,
                logoUrl,
                logoPublicId,
                createdBy: (req.body as any).createdBy ?? undefined
            });

            await choir.save();

            await createDefaultThemesForChoir(choir.id);
            await ensureDefaultSettingsForChoir(choir.id);

            await registerLog({
                req,
                collection: 'Choirs',
                action: 'create',
                referenceId: choir.id.toString(),
                changes: { new: choir.toJSON() }
            });

            res.status(201).json(choir.toJSON());
        } catch (err: any) {
            console.error('Error creating choir:', err);
            res.status(500).json({
                message: 'Error creating choir',
                error: err.message
            });
        }
    }
);

// ---------- UPDATE CHOIR (SUPER_ADMIN) + OPTIONAL NEW LOGO ----------
router.put(
    '/:id',
    verifyToken,
    uploadChoirLogo.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
                res.status(403).json({ message: 'Solo SUPER_ADMIN puede actualizar coros' });
                return;
            }

            const { id } = req.params;
            const body = parseBody(req as unknown as Request);
            const { name, code, description } = body;

            const choir = await Choir.findById(id);
            if (!choir) {
                res.status(404).json({ message: 'Choir not found' });
                return;
            }

            if (code && code !== choir.code) {
                const normalizedCode = String(code).trim().toLowerCase();
                const existing = await Choir.findOne({ code: normalizedCode });
                if (existing && existing.id.toString() !== id) {
                    res.status(409).json({ message: 'Ya existe un coro con ese código' });
                    return;
                }
                choir.code = normalizedCode;
            }

            if (name !== undefined) choir.name = String(name).trim();
            if (description !== undefined) choir.description = description;

            if (body.isActive !== undefined) {
                if (typeof body.isActive === 'string') {
                    choir.isActive = body.isActive === 'true';
                } else if (typeof body.isActive === 'boolean') {
                    choir.isActive = body.isActive;
                }
            }

            if (req.file) {
                const file: any = req.file;
                choir.logoUrl = file.path;
                choir.logoPublicId = file.filename;
            }

            choir.updatedBy = (req.body as any).updatedBy ?? choir.updatedBy;

            await choir.save();

            await registerLog({
                req,
                collection: 'Choirs',
                action: 'update',
                referenceId: choir.id.toString(),
                changes: { updated: choir.toJSON() }
            });

            res.json(choir.toJSON());
        } catch (err: any) {
            console.error('Error updating choir:', err);
            res.status(500).json({
                message: 'Error updating choir',
                error: err.message
            });
        }
    }
);

// ---------- DELETE CHOIR (SUPER_ADMIN) ----------
router.delete(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
                res.status(403).json({ message: 'Solo SUPER_ADMIN puede eliminar coros' });
                return;
            }

            const { id } = req.params;

            const choir = await Choir.findById(id);
            if (!choir) {
                res.status(404).json({ message: 'Choir not found' });
                return;
            }

            await Choir.findByIdAndDelete(id);

            await registerLog({
                req,
                collection: 'Choirs',
                action: 'delete',
                referenceId: choir.id.toString(),
                changes: { deleted: choir.toJSON() }
            });

            res.json({ message: 'Choir deleted successfully' });
        } catch (err: any) {
            console.error('Error deleting choir:', err);
            res.status(500).json({
                message: 'Error deleting choir',
                error: err.message
            });
        }
    }
);

export default router;
