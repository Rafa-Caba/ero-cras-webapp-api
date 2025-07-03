import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'ero-cras-gallery',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
    } as any,
});

export const uploadCloud = multer({ storage });
