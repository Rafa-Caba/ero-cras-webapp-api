import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { Types } from 'mongoose';

import { uploadAnnouncementImage } from '../middlewares/cloudinaryStorage';
import Announcement from '../models/Announcement';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAuthors } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';

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

/**
 * Helper: Resolve choirId from a key that may be:
 * - ObjectId string
 * - choir code
 * - choir name
 */
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
 * Helper: Build public filter for announcements
 * Priority:
 *  - query ?choirId=
 *  - query ?choirKey=
 *  - param :choirKey (id, code or name)
 */
const buildPublicFilter = async (req: Request): Promise<any> => {
    const { choirId, choirKey } = req.query as {
        choirId?: string;
        choirKey?: string;
    };
    const choirKeyParam = (req.params as any).choirKey as string | undefined;

    const filter: any = { isPublic: true };

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

// Public Endpoint (base, optional ?choirId= or ?choirKey=)
router.get('/public', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const announcements = await Announcement.find(filter)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name username');

        res.json(announcements.map(a => a.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public announcements' });
    }
});

// Public Endpoint with choirKey: /public/:choirKey
router.get('/public/:choirKey', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const announcements = await Announcement.find(filter)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name username');

        res.json(announcements.map(a => a.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public announcements' });
    }
});

// 🔐 Admin Endpoint (scoped by choirId for non-SUPER_ADMIN)
router.get('/admin', verifyToken, async (req: RequestWithUser, res: Response) => {
    try {
        const filter = await buildAdminFilter(req);

        const announcementsQuery = Announcement.find(filter).sort({ createdAt: -1 });
        const announcements = await applyPopulateAuthors(announcementsQuery);

        res.json(announcements.map((a: any) => a.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving admin announcements' });
    }
});

// 🔐 GET ONE (protected, choir-scoped)
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found' });
            return;
        }

        // Choir scoping: non-SUPER_ADMIN only sees their choir
        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && announcement.choirId) {
            if (announcement.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Announcement not found' });
                return;
            }
        }

        res.json(announcement.toJSON());
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🔐 Create
router.post(
    '/',
    verifyToken,
    uploadAnnouncementImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const user = req.user;
            const { title, content } = body;

            const isPublic = body.isPublic === 'true' || body.isPublic === true;

            if (!title || !content) {
                res.status(400).json({ message: 'Title and Content are required' });
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

            const newAnnouncement = new Announcement({
                title,
                content,
                isPublic,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || null,
                choirId: targetChoirId || null,
                createdBy: req.body.createdBy
            });

            await newAnnouncement.save();

            if (isPublic) {
                notifyCommunity(
                    req.user?.id,
                    req.user?.username || 'Admin',
                    'ANNOUNCEMENT',
                    newAnnouncement
                );
            }

            if (!newAnnouncement.id) {
                res.status(201).json({
                    message: 'Announcement created successfully',
                    announcement: newAnnouncement.toJSON()
                });
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'Announcements',
                action: 'create',
                referenceId: newAnnouncement.id.toString(),
                changes: { new: newAnnouncement.toJSON() }
            });

            res.status(201).json({
                message: 'Announcement created successfully',
                announcement: newAnnouncement.toJSON()
            });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: 'Error creating announcement' });
        }
    }
);

// 🔐 Update
router.put(
    '/:id',
    verifyToken,
    uploadAnnouncementImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const body = parseBody(req);

            const { title, content } = body;

            const announcement = await Announcement.findById(id);
            if (!announcement) {
                res.status(404).json({ message: 'Announcement not found' });
                return;
            }

            const user = req.user;

            // Choir scoping for non-SUPER_ADMIN
            if (user?.role !== 'SUPER_ADMIN' && user?.choirId && announcement.choirId) {
                if (announcement.choirId.toString() !== user.choirId.toString()) {
                    res.status(404).json({ message: 'Announcement not found' });
                    return;
                }
            }

            // SUPER_ADMIN can reassign choir
            if (user?.role === 'SUPER_ADMIN') {
                if (body.choirId) {
                    announcement.choirId = body.choirId;
                } else if (body.choirKey) {
                    const resolved = await resolveChoirIdFromKey(body.choirKey);
                    if (resolved) {
                        announcement.choirId = resolved as any;
                    }
                }
            }

            if (req.file) {
                if (announcement.imagePublicId) {
                    await cloudinary.uploader.destroy(announcement.imagePublicId);
                }
                announcement.imageUrl = req.file.path;
                announcement.imagePublicId = req.file.filename;
            }

            let isPublicFlag = announcement.isPublic;

            if (title) announcement.title = title;
            if (content) announcement.content = content;
            if (body.isPublic !== undefined) {
                isPublicFlag = body.isPublic === 'true' || body.isPublic === true;
                announcement.isPublic = isPublicFlag;
            }

            announcement.updatedBy = req.body.updatedBy;

            await announcement.save();

            if (isPublicFlag) {
                notifyCommunity(
                    req.user?.id,
                    req.user?.username || 'Admin',
                    'ANNOUNCEMENT',
                    announcement
                );
            }

            await registerLog({
                req: req as any,
                collection: 'Announcements',
                action: 'update',
                referenceId: announcement.id.toString(),
                changes: { updated: announcement.toJSON() }
            });

            res.json(announcement.toJSON());
        } catch (error: any) {
            console.error('Error updating announcement:', error);
            res.status(500).json({ message: 'Error updating announcement' });
        }
    }
);

// 🔐 Delete
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found' });
            return;
        }

        const user = req.user;
        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && announcement.choirId) {
            if (announcement.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Announcement not found' });
                return;
            }
        }

        if (announcement.imagePublicId) {
            await cloudinary.uploader.destroy(announcement.imagePublicId);
        }

        await Announcement.findByIdAndDelete(req.params.id);

        await registerLog({
            req: req as any,
            collection: 'Announcements',
            action: 'delete',
            referenceId: announcement.id.toString(),
            changes: { deleted: announcement.toJSON() }
        });

        res.json({ message: 'Announcement deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error deleting announcement' });
    }
});

export default router;
