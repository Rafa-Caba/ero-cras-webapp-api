import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

import Settings from '../models/Settings';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { uploadGalleryImage } from '../middlewares/cloudinaryStorage';
import { setUpdatedBy } from '../utils/setCreatedBy';
import { applyPopulateSingleAuthor } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';

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

// Public Endpoint (optionally choir-scoped)
router.get('/public', async (req: Request, res: Response) => {
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

        let settingsDoc: any;

        if (Object.keys(filter).length > 0) {
            settingsDoc = await Settings.findOne(filter);
        } else {
            settingsDoc = await Settings.findOne();
        }

        if (!settingsDoc) {
            const newPayload: any = {
                history: { type: 'doc', content: [] }
            };
            if (filter.choirId) {
                newPayload.choirId = filter.choirId;
            }

            const newSettings = new Settings(newPayload);
            await newSettings.save();
            settingsDoc = newSettings;
        }

        res.json(settingsDoc.toJSON());
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving public settings',
            error: error.message
        });
    }
});

// Private Endpoint (choir-scoped)
router.get('/', verifyToken, async (req: RequestWithUser, res: Response) => {
    try {
        const user = req.user;
        const { choirId: queryChoirId, choirKey } = req.query as {
            choirId?: string;
            choirKey?: string;
        };

        const filter: any = {};

        if (user?.role !== 'SUPER_ADMIN') {
            if (user?.choirId) {
                filter.choirId = user.choirId;
            }
        } else {
            if (queryChoirId) {
                filter.choirId = queryChoirId;
            } else if (choirKey) {
                const resolved = await resolveChoirIdFromKey(choirKey);
                if (resolved) {
                    filter.choirId = resolved;
                }
            } else if (user?.choirId) {
                filter.choirId = user.choirId;
            }
        }

        let settingsDoc: any;

        if (Object.keys(filter).length > 0) {
            settingsDoc = await Settings.findOne(filter);
        } else {
            settingsDoc = await Settings.findOne();
        }

        if (!settingsDoc) {
            const payload: any = {
                history: { type: 'doc', content: [] }
            };

            if (filter.choirId) {
                payload.choirId = filter.choirId;
            } else if (user?.choirId) {
                payload.choirId = user.choirId;
            }

            const newSettings = new Settings(payload);
            await newSettings.save();
            settingsDoc = newSettings;
        }

        const populated = await applyPopulateSingleAuthor(
            Settings.findById(settingsDoc.id)
        );

        res.json(populated ? populated.toJSON() : settingsDoc.toJSON());
    } catch (error: any) {
        console.error('Settings GET Error:', error);
        res.status(500).json({
            message: 'Error retrieving settings',
            error: error.message
        });
    }
});

// Update (choir-scoped)
router.put(
    '/',
    verifyToken,
    uploadGalleryImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const user = req.user;

            const { choirId: bodyChoirId, choirKey } = body as {
                choirId?: string;
                choirKey?: string;
            };

            let targetChoirId: string | null = null;

            if (user?.role === 'SUPER_ADMIN') {
                if (bodyChoirId) {
                    targetChoirId = bodyChoirId;
                } else if (choirKey) {
                    targetChoirId = await resolveChoirIdFromKey(choirKey);
                } else if (user.choirId) {
                    targetChoirId = user.choirId;
                }
            } else if (user?.choirId) {
                targetChoirId = user.choirId;
            }

            const filter: any = {};
            if (targetChoirId) {
                filter.choirId = targetChoirId;
            }

            let settingsDoc: any;

            if (Object.keys(filter).length > 0) {
                settingsDoc = await Settings.findOne(filter);
            } else {
                settingsDoc = await Settings.findOne();
            }

            if (!settingsDoc) {
                const payload: any = {};
                if (targetChoirId) {
                    payload.choirId = targetChoirId;
                }
                payload.history = { type: 'doc', content: [] };

                settingsDoc = new Settings(payload);
            }

            if (body.webTitle) settingsDoc.webTitle = body.webTitle;
            if (body.contactPhone) settingsDoc.contactPhone = body.contactPhone;

            if (body.homeLegends) {
                settingsDoc.homeLegends = {
                    ...settingsDoc.homeLegends,
                    ...body.homeLegends
                };
            }
            if (body.socials) {
                settingsDoc.socials = {
                    ...settingsDoc.socials,
                    ...body.socials
                };
            }
            if (body.history) {
                settingsDoc.history = body.history;
            }

            if (targetChoirId) {
                settingsDoc.choirId = targetChoirId;
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

            const populated = await Settings.findById(settingsDoc.id).populate(
                'updatedBy',
                'name username'
            );

            await registerLog({
                req: req as any,
                collection: 'Settings',
                action: 'update',
                referenceId: settingsDoc.id.toString(),
                changes: { after: settingsDoc.toJSON() }
            });

            res.json(populated ? populated.toJSON() : settingsDoc.toJSON());
        } catch (error: any) {
            console.error('Error updating settings:', error);
            res.status(500).json({
                message: 'Error updating settings',
                error: error.message
            });
        }
    }
);

export default router;
