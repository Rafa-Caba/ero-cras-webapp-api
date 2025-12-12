import express, { Request, Response } from 'express';
import { Types } from 'mongoose';

import verifyToken, { RequestWithUser } from '../middlewares/auth';
import Log from '../models/Log';
import Choir from '../models/Choir';

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

// GET LOGS (Paginated & Filtered, Choir-Scoped)
router.get('/', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const {
            page = '1',
            limit = '10',
            collection,
            action,
            userId,
            choirId: queryChoirId,
            choirKey
        } = req.query as {
            page?: string;
            limit?: string;
            collection?: string;
            action?: string;
            userId?: string;
            choirId?: string;
            choirKey?: string;
        };

        const pageNumber = Number(page) || 1;
        const limitNumber = Number(limit) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const filters: any = {};

        if (collection) filters.collectionName = collection;
        if (action) filters.action = action;
        if (userId) filters.user = userId;

        // 🔐 Choir scoping
        const authUser = req.user;
        let choirFilterId: string | null = null;

        if (authUser?.role === 'SUPER_ADMIN') {
            if (queryChoirId) {
                choirFilterId = queryChoirId;
            } else if (choirKey) {
                choirFilterId = await resolveChoirIdFromKey(choirKey);
            }
        } else if (authUser?.choirId) {
            choirFilterId = authUser.choirId;
        }

        if (choirFilterId) {
            filters.choirId = choirFilterId;
        }

        const [logs, total] = await Promise.all([
            Log.find(filters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNumber)
                .populate('user', 'name username role'),
            Log.countDocuments(filters)
        ]);

        const totalPages = Math.ceil(total / limitNumber);

        res.json({
            logs: logs.map(l => l.toJSON()),
            currentPage: pageNumber,
            totalPages,
            totalLogs: total
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving logs', error: error.message });
    }
});

// GET LOGS BY USER (Choir-Scoped)
router.get('/user/:userId', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 6;
        const skip = (page - 1) * limit;

        const filters: any = { user: userId };

        // Choir scoping
        const authUser = req.user;
        if (authUser?.role !== 'SUPER_ADMIN' && authUser?.choirId) {
            filters.choirId = authUser.choirId;
        } else if (authUser?.role === 'SUPER_ADMIN') {
            const { choirId: queryChoirId, choirKey } = req.query as {
                choirId?: string;
                choirKey?: string;
            };

            if (queryChoirId) {
                filters.choirId = queryChoirId;
            } else if (choirKey) {
                const resolved = await resolveChoirIdFromKey(choirKey);
                if (resolved) {
                    filters.choirId = resolved;
                }
            }
        }

        const [logs, totalLogs] = await Promise.all([
            Log.find(filters)
                .populate('user', 'name username role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Log.countDocuments(filters)
        ]);

        const totalPages = Math.ceil(totalLogs / limit);

        res.json({
            logs: logs.map(l => l.toJSON()),
            currentPage: page,
            totalPages
        });
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving user logs', error: err.message });
    }
});

export default router;
