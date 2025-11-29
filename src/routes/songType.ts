import express, { Request, Response } from 'express';
import SongType from '../models/SongType';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';

const router = express.Router();

// 🟣 PUBLIC ENDPOINT (Get all types)
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const types = await SongType.find().sort({ order: 1 });
        
        // Return object structure to match your legacy/mobile expectation
        res.json({ types });
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving public song types', error: err.message });
    }
});

// 🟣 ADMIN LIST (Protected)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { all, page, limit } = req.query;

        // If 'all=true', return everything (for dropdowns)
        if (all === 'true' || !page) {
            const queryTypes = SongType.find().sort({ order: 1 });
            const types = await applyPopulateAutores(queryTypes);
            res.json({ types, totalTypes: types.length });
        } else {
            // Pagination Logic
            const pageNum = parseInt(page as string) || 1;
            const limitNum = parseInt(limit as string) || 6;
            const skip = (pageNum - 1) * limitNum;

            const totalTypes = await SongType.countDocuments();
            const totalPages = Math.ceil(totalTypes / limitNum);

            const queryTypes = SongType.find()
                .sort({ order: 1 })
                .skip(skip)
                .limit(limitNum);

            const types = await applyPopulateAutores(queryTypes);

            res.json({
                types,
                currentPage: pageNum,
                totalPages
            });
        }
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving song types', error: err.message });
    }
});

// 🟣 GET ONE
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const type = await applyPopulateAutorSingle(SongType.findById(id));

        if (!type) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }
        res.json(type);
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving song type', error: err.message });
    }
});

// 🟣 CREATE
router.post('/', 
    verifyToken, 
    setCreatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        // Map fields (Mobile/Web might send 'nombre' legacy or 'name')
        const name = req.body.name || req.body.nombre;
        const order = req.body.order || req.body.orden;
        
        // 🆕 Hierarchy Fields
        const parentId = req.body.parentId || null;
        const isParent = req.body.isParent === true || req.body.isParent === 'true';

        if (!name) {
            res.status(400).json({ message: 'Name is required' });
            return;
        }

        const existing = await SongType.findOne({ name });
        if (existing) {
            res.status(409).json({ message: 'A song type with this name already exists.' });
            return;
        }

        const newType = new SongType({ 
            name, 
            order, 
            parentId, 
            isParent,
            createdBy: req.body.createdBy 
        });
        
        await newType.save();

        if (!newType._id) return;

        await registerLog({
            req: req as any,
            collection: 'SongTypes',
            action: 'create',
            referenceId: newType._id.toString(),
            changes: { new: newType }
        });

        res.status(201).json(newType);
    } catch (err: any) {
        res.status(500).json({ message: 'Error creating song type', error: err.message });
    }
});

// 🟣 UPDATE
router.put('/:id', 
    verifyToken, 
    setUpdatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        const name = req.body.name || req.body.nombre;
        const order = req.body.order || req.body.orden;
        const parentId = req.body.parentId;
        const isParent = req.body.isParent;

        const existing = await SongType.findOne({ name });

        // Check for duplicates (but allow if it's the same ID)
        if (existing && existing.id.toString() !== id) {
            res.status(409).json({ message: 'Another song type with this name already exists.' });
            return;
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (order !== undefined) updateData.order = order;
        if (parentId !== undefined) updateData.parentId = parentId;
        if (isParent !== undefined) updateData.isParent = isParent;
        
        updateData.updatedBy = req.body.updatedBy;

        const updatedType = await SongType.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!updatedType) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        await registerLog({
            req: req as any,
            collection: 'SongTypes',
            action: 'update',
            referenceId: updatedType.id.toString(),
            changes: { after: updatedType }
        });

        res.json(updatedType);
    } catch (err: any) {
        res.status(500).json({ message: 'Error updating song type', error: err.message });
    }
});

// 🟣 DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const type = await SongType.findById(id);

        if (!type) {
            res.status(404).json({ message: 'Song type not found' });
            return;
        }

        await SongType.findByIdAndDelete(id);

        await registerLog({
            req: req as any,
            collection: 'SongTypes',
            action: 'delete',
            referenceId: type.id.toString(),
            changes: { deleted: type }
        });

        res.json({ message: 'Song type deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: 'Error deleting song type', error: err.message });
    }
});

export default router;