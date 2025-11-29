import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { uploadAnnouncementImage } from '../middlewares/cloudinaryStorage'; 
import Announcement from '../models/Announcement';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAutores } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';

const router = express.Router();

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

// Public Endpoint
router.get('/public', async (_req: Request, res: Response) => {
    try {
        const announcements = await Announcement.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name username');
            
        res.json(announcements);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public announcements' });
    }
});

// Admin Endpoint
router.get('/admin', verifyToken, async (req: Request, res: Response) => {
    try {
        const announcements = await applyPopulateAutores(Announcement.find().sort({ createdAt: -1 }));
        res.json(announcements);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving admin announcements' });
    }
});

// Create
router.post('/', 
    verifyToken, 
    uploadAnnouncementImage.single('file'), // Standard field name: 'file'
    setCreatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        
        const { title, content } = body;
        
        const isPublic = body.isPublic === 'true' || body.isPublic === true;

        if (!title || !content) {
            res.status(400).json({ message: 'Title and Content are required' });
            return;
        }

        const newAnnouncement = new Announcement({
            title,
            content,
            isPublic,
            imageUrl: req.file?.path || '',
            imagePublicId: req.file?.filename || null,
            createdBy: req.body.createdBy
        });

        await newAnnouncement.save();

        if (isPublic) {
            notifyCommunity(
                req.user?.id, 
                'Admin', 
                'ANNOUNCEMENT', 
                newAnnouncement
            );
        }

        if (!newAnnouncement._id) return;

        await registerLog({
            req: req as any,
            collection: 'Announcements',
            action: 'create',
            referenceId: newAnnouncement._id.toString(),
            changes: { new: newAnnouncement }
        });

        res.status(201).json({ message: 'Announcement created successfully', announcement: newAnnouncement });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating announcement' });
    }
});

// Update
router.put('/:id', 
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

        if (req.file) {
            if (announcement.imagePublicId) {
                await cloudinary.uploader.destroy(announcement.imagePublicId);
            }
            announcement.imageUrl = req.file.path;
            announcement.imagePublicId = req.file.filename;
        }

        let isPublic = false;

        if (title) announcement.title = title;
        if (content) announcement.content = content;
        if (body.isPublic !== undefined) {
            isPublic = body.isPublic === 'true' || body.isPublic === true;
            announcement.isPublic = isPublic;
        }

        announcement.updatedBy = req.body.updatedBy;

        await announcement.save();

        if (isPublic) {
            notifyCommunity(
                req.user?.id, 
                'Admin', 
                'ANNOUNCEMENT', 
                announcement
            );
        }

        await registerLog({
            req: req as any,
            collection: 'Announcements',
            action: 'update',
            referenceId: announcement.id.toString(),
            changes: { updated: announcement }
        });

        res.json(announcement);
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({ message: 'Error updating announcement' });
    }
});

// Delete
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found' });
            return;
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
            changes: { deleted: announcement }
        });

        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting announcement' });
    }
});

export default router;