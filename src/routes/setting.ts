import express, { Request, Response } from 'express';
import Settings from '../models/Settings';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { v2 as cloudinary } from 'cloudinary';
import { uploadGalleryImage } from '../middlewares/cloudinaryStorage';
import { setUpdatedBy } from '../utils/setCreatedBy';
import { applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';

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
        let settingsDoc = await Settings.findOne();
        if (!settingsDoc) {
            settingsDoc = new Settings({ history: { type: 'doc', content: [] } });
            await settingsDoc.save();
        }
        res.json(settingsDoc);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public settings', error: error.message });
    }
});

// Private Endpoint
router.get('/', verifyToken, async (_req: RequestWithUser, res: Response) => {
    try {
        let settingsDoc = await Settings.findOne();

        if (!settingsDoc) {
            settingsDoc = new Settings({ history: { type: 'doc', content: [] } });
            await settingsDoc.save();
        }

        const populated = await applyPopulateAutorSingle(Settings.findById(settingsDoc._id));
        res.json(populated);
    } catch (error: any) {
        console.error("Settings GET Error:", error);
        res.status(500).json({ message: 'Error retrieving settings', error: error.message });
    }
});

// Update
router.put('/',
    verifyToken,
    uploadGalleryImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);

            let settingsDoc = await Settings.findOne();
            if (!settingsDoc) {
                settingsDoc = new Settings();
            }

            if (body.webTitle) settingsDoc.webTitle = body.webTitle;
            if (body.contactPhone) settingsDoc.contactPhone = body.contactPhone;

            if (body.homeLegends) {
                settingsDoc.homeLegends = { ...settingsDoc.homeLegends, ...body.homeLegends };
            }
            if (body.socials) {
                settingsDoc.socials = { ...settingsDoc.socials, ...body.socials };
            }
            if (body.history) {
                settingsDoc.history = body.history;
            }

            if (req.file) {
                if (settingsDoc.logoPublicId) {
                    await cloudinary.uploader.destroy(settingsDoc.logoPublicId);
                }
                settingsDoc.logoUrl = req.file.path;
                settingsDoc.logoPublicId = req.file.filename;
            }

            settingsDoc.updatedBy = req.body.updatedBy;

            await settingsDoc.save();

            const populated = await Settings.findById(settingsDoc._id).populate('updatedBy', 'name username');

            await registerLog({
                req: req as any,
                collection: 'Settings',
                action: 'update',
                referenceId: settingsDoc.id.toString(),
                changes: { after: settingsDoc }
            });

            res.json(populated);
        } catch (error: any) {
            console.error('Error updating settings:', error);
            res.status(500).json({ message: 'Error updating settings', error: error.message });
        }
    });

export default router;