import express, { Request, Response } from 'express';
import verifyToken from '../middlewares/auth';
import Log from '../models/Log';

const router = express.Router();

// 🟣 GET LOGS (Paginated & Filtered)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 10, collection, action, userId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filters: any = {};

        // Map query params to English Schema keys
        if (collection) filters.collectionName = collection;
        if (action) filters.action = action;
        if (userId) filters.user = userId;

        const [logs, total] = await Promise.all([
            Log.find(filters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('user', 'name username role'),
            Log.countDocuments(filters),
        ]);

        const totalPages = Math.ceil(total / Number(limit));

        res.json({
            logs,
            currentPage: Number(page),
            totalPages,
            totalLogs: total,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving logs', error });
    }
});

// 🟣 GET LOGS BY USER
router.get('/user/:userId', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 6;
        const skip = (page - 1) * limit;

        const [logs, totalLogs] = await Promise.all([
            Log.find({ user: userId })
                .populate('user', 'name username role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Log.countDocuments({ user: userId })
        ]);

        const totalPages = Math.ceil(totalLogs / limit);

        res.json({
            logs,
            currentPage: page,
            totalPages
        });
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving user logs', error: err.message });
    }
});

export default router;