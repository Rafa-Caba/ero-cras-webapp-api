import express, { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { uploadGalleryImage, deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import GalleryImage from '../models/GalleryImage';
import Choir from '../models/Choir';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
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

/**
 * Resolve choirId from:
 * - direct ObjectId
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

    // Use .id (virtual) to avoid TS complaints on _id
    return choir ? (choir as any).id : null;
};

/**
 * Build public filter:
 *  - ?choirId= (query)
 *  - /public/:choirKey (id, code or name)
 */
const buildPublicFilter = async (req: Request): Promise<any> => {
    const { choirId } = req.query;
    const choirKeyParam = (req.params as any).choirKey as string | undefined;

    const filter: any = {};

    const resolvedChoirId =
        (choirId && typeof choirId === 'string')
            ? choirId
            : (choirKeyParam ? await resolveChoirIdFromKey(choirKeyParam) : null);

    if (resolvedChoirId) {
        filter.choirId = resolvedChoirId;
    }

    return filter;
};

// PUBLIC LIST (base) - /gallery/public?choirId=...
router.get(['/public'], async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const images = await GalleryImage.find(filter).sort({ createdAt: -1 });
        res.json(images.map(img => img.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public gallery images' });
    }
});

// PUBLIC LIST by choirKey - /gallery/public/:choirKey
router.get('/public/:choirKey', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const images = await GalleryImage.find(filter).sort({ createdAt: -1 });
        res.json(images.map(img => img.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public gallery images' });
    }
});

router.get('/', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);
        const images = await GalleryImage.find(filter).sort({ createdAt: -1 });
        res.json(images.map(img => img.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public gallery images' });
    }
});

// CREATE (scoped to req.user.choirId)
router.post(
    '/',
    verifyToken,
    uploadGalleryImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file received' });
                return;
            }

            const body = parseBody(req);
            const mimetype = req.file.mimetype || '';

            const isVideo =
                mimetype.startsWith('video') ||
                mimetype.includes('mp4') ||
                mimetype.includes('mov') ||
                mimetype.includes('quicktime');

            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            const { title, description } = body;

            const choirId = req.user?.choirId;
            if (!choirId) {
                res.status(400).json({ message: 'Missing choirId in user token' });
                return;
            }

            const isGalleryImage =
                body.imageGallery === true || String(body.imageGallery) === 'true';

            console.log('📂 File Uploaded:', {
                filename: req.file.filename,
                mimetype,
                detectedType: mediaType
            });

            const newImage = new GalleryImage({
                title,
                description,
                mediaType,
                imageUrl: req.file.path,
                imagePublicId: req.file.filename,
                imageGallery: isGalleryImage,

                imageStart: String(body.imageStart) === 'true',
                imageTopBar: String(body.imageTopBar) === 'true',
                imageUs: String(body.imageUs) === 'true',
                imageLogo: String(body.imageLogo) === 'true',
                imageLeftMenu: String(body.imageLeftMenu) === 'true',
                imageRightMenu: String(body.imageRightMenu) === 'true',

                choirId,
                createdBy: req.body.createdBy
            });

            await newImage.save();

            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'create',
                referenceId: newImage.id.toString(),
                changes: { new: newImage.toJSON() }
            });

            res.status(200).json({
                message: 'File uploaded successfully',
                image: newImage.toJSON()
            });
        } catch (err: any) {
            console.error('Server Error:', err);
            res.status(400).json({ message: err.message });
        }
    }
);

// UPDATE (choir-scoped)
router.put(
    '/:id',
    verifyToken,
    uploadGalleryImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, description } = body;

            const image = await GalleryImage.findById(req.params.id);
            if (!image) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }

            const user = req.user;
            if (user?.role !== 'SUPER_ADMIN' && user?.choirId && image.choirId) {
                if (image.choirId.toString() !== user.choirId.toString()) {
                    res.status(404).json({ message: 'Image not found' });
                    return;
                }
            }

            // File Replacement
            if (req.file) {
                if (image.imagePublicId) {
                    const resourceType = image.mediaType === 'VIDEO' ? 'video' : 'image';
                    await deleteFromCloudinary(image.imagePublicId, resourceType);
                }

                const mimetype = req.file.mimetype || '';
                const isVideo = mimetype.startsWith('video') || mimetype.includes('mp4');

                image.imageUrl = req.file.path;
                image.imagePublicId = req.file.filename;
                image.mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            }

            if (title) image.title = title;
            if (description !== undefined) image.description = description;

            image.updatedBy = req.body.updatedBy;

            await image.save();

            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'update',
                referenceId: image.id.toString(),
                changes: { updated: image.toJSON() }
            });

            res.json({
                message: 'Image updated successfully',
                image: image.toJSON()
            });
        } catch (err: any) {
            res.status(500).json({ message: err.message });
        }
    }
);

// GET ONE (protected, choir-scoped)
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const image = await applyPopulateSingleAuthor(
            GalleryImage.findById(req.params.id)
        );

        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        const imgDoc: any = image;

        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && imgDoc.choirId) {
            if (imgDoc.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }
        }

        res.json(imgDoc.toJSON ? imgDoc.toJSON() : imgDoc);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE (choir-scoped)
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const image = await GalleryImage.findById(req.params.id);
        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        const user = req.user;
        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && image.choirId) {
            if (image.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }
        }

        if (image.imagePublicId) {
            const resourceType = image.mediaType === 'VIDEO' ? 'video' : 'image';
            await deleteFromCloudinary(image.imagePublicId, resourceType);
        }

        await GalleryImage.findByIdAndDelete(req.params.id);

        await registerLog({
            req: req as any,
            collection: 'GalleryImages',
            action: 'delete',
            referenceId: image.id.toString(),
            changes: { deleted: image.toJSON() }
        });

        res.json({ message: 'Image deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// PATCH FLAGS (single-slot flags, choir-scoped)
// router.patch(
//     '/mark/:field/:id',
//     verifyToken,
//     setUpdatedBy,
//     async (req: RequestWithUser, res: Response): Promise<void> => {
//         const field = req.params.field;
//         const id = req.params.id.trim();

//         try {
//             const validFields = [
//                 'imageStart',
//                 'imageTopBar',
//                 'imageUs',
//                 'imageLogo',
//                 'imageGallery',
//                 'imageLeftMenu',
//                 'imageRightMenu'
//             ];

//             if (!validFields.includes(field)) {
//                 res.status(400).json({ message: 'Invalid field' });
//                 return;
//             }

//             const image = await GalleryImage.findById(id);
//             if (!image) {
//                 res.status(404).json({ message: 'Image not found' });
//                 return;
//             }

//             const user = req.user;
//             if (user?.role !== 'SUPER_ADMIN' && user?.choirId && image.choirId) {
//                 if (image.choirId.toString() !== user.choirId.toString()) {
//                     res.status(404).json({ message: 'Image not found' });
//                     return;
//                 }
//             }

//             const choirId = image.choirId;

//             const update: Partial<Record<string, boolean>> = {};
//             update[field] = true;

//             // Mutual exclusivity per choir (except gallery)
//             if (field !== 'imageGallery') {
//                 await GalleryImage.updateMany(
//                     {
//                         [field]: true,
//                         ...(choirId ? { choirId } : {})
//                     },
//                     { $set: { [field]: false } }
//                 );
//             }

//             const updatedImage = await GalleryImage.findByIdAndUpdate(
//                 id,
//                 { $set: update },
//                 { new: true }
//             );

//             if (!updatedImage) {
//                 res.status(404).json({ message: 'Image not found after update' });
//                 return;
//             }

//             await registerLog({
//                 req: req as any,
//                 collection: 'GalleryImages',
//                 action: 'update',
//                 referenceId: updatedImage.id.toString(),
//                 changes: { after: updatedImage.toJSON() }
//             });

//             res.json({
//                 message: `Field ${field} updated`,
//                 image: updatedImage.toJSON()
//             });
//         } catch (err: any) {
//             res.status(500).json({ message: (err as Error).message });
//         }
//     }
// );
router.patch(
    '/mark/:field/:id',
    verifyToken,
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const field = req.params.field;
            const id = req.params.id.trim();
            const user = req.user;

            const validFields = [
                'imageStart',
                'imageTopBar',
                'imageUs',
                'imageLogo',
                'imageGallery',
                'imageLeftMenu',
                'imageRightMenu'
            ];

            if (!validFields.includes(field)) {
                res.status(400).json({ message: 'Invalid field' });
                return;
            }

            const image = await GalleryImage.findById(id);
            if (!image) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }

            // Choir scoping (SUPER_ADMIN bypasses)
            if (user?.role !== 'SUPER_ADMIN') {
                if (!user?.choirId || image.choirId.toString() !== user.choirId.toString()) {
                    res.status(404).json({ message: 'Image not found' });
                    return;
                }
            }

            const choirId = image.choirId;

            // Prepare update document
            const update: Record<string, any> = {
                [field]: true,
                updatedBy: user?.id ?? null
            };

            // Mutually exclusive flags (except gallery which allows multi)
            if (field !== 'imageGallery') {
                await GalleryImage.updateMany(
                    {
                        [field]: true,
                        choirId
                    },
                    {
                        $set: { [field]: false }
                    }
                );
            }

            const updatedImage = await GalleryImage.findByIdAndUpdate(
                id,
                { $set: update },
                { new: true }
            );

            if (!updatedImage) {
                res
                    .status(404)
                    .json({ message: 'Image not found after update attempt' });
                return;
            }

            // Log activity
            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'update',
                referenceId: updatedImage.id.toString(),
                changes: { after: updatedImage.toJSON() }
            });

            res.json({
                message: `Field ${field} updated`,
                image: updatedImage.toJSON()
            });
        } catch (err: any) {
            console.error('PATCH /gallery/mark error:', err);
            res.status(500).json({ message: err.message });
        }
    }
);

// PATCH imageGallery toggle (choir-scoped)
router.patch(
    '/mark/imageGallery/:id',
    verifyToken,
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        const id = req.params.id.trim();
        const { value } = req.body;

        if (typeof value !== 'boolean') {
            res.status(400).json({ message: 'Value must be boolean' });
            return;
        }

        try {
            const image = await GalleryImage.findById(id);
            if (!image) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }

            const user = req.user;
            if (user?.role !== 'SUPER_ADMIN' && user?.choirId && image.choirId) {
                if (image.choirId.toString() !== user.choirId.toString()) {
                    res.status(404).json({ message: 'Image not found' });
                    return;
                }
            }

            image.imageGallery = value;
            image.updatedBy = req.body.updatedBy;

            await image.save();

            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'update',
                referenceId: image.id.toString(),
                changes: { updated: image.toJSON() }
            });

            res.json({
                message: `Field imageGallery updated to ${value}`,
                image: image.toJSON()
            });
        } catch (err: any) {
            res.status(500).json({ message: (err as Error).message });
        }
    }
);

export default router;
