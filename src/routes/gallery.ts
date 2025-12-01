import express, { NextFunction, Request, Response } from 'express';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { v2 as cloudinary } from 'cloudinary';
import { uploadGalleryImage } from '../middlewares/cloudinaryStorage';
import GalleryImage from '../models/GalleryImage';
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
            console.error("Error parsing JSON from mobile:", e);
        }
    }
    return body;
};

// Public Route
router.get(['/', '/public'], async (req: Request, res: Response) => {
    try {
        const images = await GalleryImage.find().sort({ createdAt: -1 });
        res.json(images);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving public gallery images' });
    }
});

// Create
router.post('/',
    verifyToken,
    uploadGalleryImage.single('file'), // Standard field name: 'file'
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file received' });
                return;
            }

            const body = parseBody(req);
            const mimetype = req.file.mimetype || '';

            // Robust Video Detection
            const isVideo = mimetype.startsWith('video') ||
                mimetype.includes('mp4') ||
                mimetype.includes('mov') ||
                mimetype.includes('quicktime');

            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

            const { title, description } = body;

            const isGalleryImage = body.imageGallery === true || String(body.imageGallery) === 'true';

            console.log("📂 File Uploaded:", { filename: req.file.filename, mimetype, detectedType: mediaType });

            const newImage = new GalleryImage({
                title,
                description,
                mediaType,
                imageUrl: req.file.path,
                imagePublicId: req.file.filename,
                imageGallery: isGalleryImage,

                // Boolean Flags
                imageStart: String(body.imageStart) === 'true',
                imageTopBar: String(body.imageTopBar) === 'true',
                imageUs: String(body.imageUs) === 'true',
                imageLogo: String(body.imageLogo) === 'true',
                imageLeftMenu: String(body.imageLeftMenu) === 'true',
                imageRightMenu: String(body.imageRightMenu) === 'true',

                createdBy: req.body.createdBy
            });

            await newImage.save();

            if (!newImage._id) return;

            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'create',
                referenceId: newImage._id.toString(),
                changes: { new: newImage }
            });

            res.status(200).json({ message: 'File uploaded successfully', image: newImage });
        } catch (err: any) {
            console.error("Server Error:", err);
            res.status(400).json({ message: err.message });
        }
    }
);

// UPDATE
router.put('/:id',
    verifyToken,
    uploadGalleryImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req); // Reuse your existing helper
            const { title, description } = body;

            const image = await GalleryImage.findById(req.params.id);
            if (!image) {
                res.status(404).json({ message: 'Image not found' });
                return;
            }

            // 1. Handle File Replacement
            if (req.file) {
                // Delete old image from Cloudinary
                if (image.imagePublicId) {
                    const resourceType = image.mediaType === 'VIDEO' ? 'video' : 'image';
                    await cloudinary.uploader.destroy(image.imagePublicId, { resource_type: resourceType });
                }

                // Detect new media type
                const mimetype = req.file.mimetype || '';
                const isVideo = mimetype.startsWith('video') || mimetype.includes('mp4');

                image.imageUrl = req.file.path;
                image.imagePublicId = req.file.filename;
                image.mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            }

            // 2. Update Text Fields
            if (title) image.title = title;
            if (description !== undefined) image.description = description;

            image.updatedBy = req.body.updatedBy;

            await image.save();

            // Log change
            await registerLog({
                req: req as any,
                collection: 'GalleryImages',
                action: 'update',
                referenceId: image.id.toString(),
                changes: { updated: image }
            });

            res.json({ message: 'Image updated successfully', image });
        } catch (err: any) {
            res.status(500).json({ message: err.message });
        }
    }
);

// Get One
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const image = await applyPopulateSingleAuthor(GalleryImage.findById(req.params.id));
        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }
        res.json(image);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Delete
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
        const image = await GalleryImage.findById(req.params.id);
        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        if (image.imagePublicId) {
            const resourceType = image.mediaType === 'VIDEO' ? 'video' : 'image';
            await cloudinary.uploader.destroy(image.imagePublicId, { resource_type: resourceType });
        }

        await GalleryImage.findByIdAndDelete(req.params.id);

        await registerLog({
            req: req as any,
            collection: 'GalleryImages',
            action: 'delete',
            referenceId: image.id.toString(),
            changes: { deleted: image }
        });

        res.json({ message: 'Image deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Patch Flags
router.patch('/mark/:field/:id', setUpdatedBy, async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    const field = req.params.field;
    const id = req.params.id.trim();

    try {
        const validFields = [
            'imageStart', 'imageTopBar', 'imageUs', 'imageLogo', 'imageGallery', 'imageLeftMenu', 'imageRightMenu'
        ];

        if (!validFields.includes(field)) {
            res.status(400).json({ message: 'Invalid field' });
            return;
        }

        const update: Partial<Record<string, boolean>> = {};
        update[field] = true;

        // Mutual exclusivity for flags other than gallery
        if (field !== 'imageGallery') {
            await GalleryImage.updateMany({ [field]: true }, { $set: { [field]: false } });
        }

        const updatedImage = await GalleryImage.findByIdAndUpdate(id, { $set: update }, { new: true });

        if (!updatedImage) return;

        await registerLog({
            req: req as any,
            collection: 'GalleryImages',
            action: 'update',
            referenceId: updatedImage.id.toString(),
            changes: { after: updatedImage }
        });

        res.json({ message: `Field ${field} updated`, image: updatedImage });
    } catch (err: any) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Patch Gallery Toggle
router.patch('/mark/imageGallery/:id', setUpdatedBy, async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    const id = req.params.id.trim();
    const { value } = req.body;

    if (typeof value !== 'boolean') {
        res.status(400).json({ message: 'Value must be boolean' });
        return;
    }

    try {
        const updatedImage = await GalleryImage.findByIdAndUpdate(
            id,
            { $set: { imageGallery: value } },
            { new: true }
        );

        if (!updatedImage) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        res.json({
            message: `Field imageGallery updated to ${value}`,
            image: updatedImage,
        });
    } catch (err: any) {
        res.status(500).json({ message: (err as Error).message });
    }
});

export default router;