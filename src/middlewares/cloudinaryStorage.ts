import { Request } from 'express';
import multer, { StorageEngine } from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CustomCloudinaryStorage implements StorageEngine {
    private folder: string;
    private resourceType: 'image' | 'video' | 'auto';
    private allowedFormats: string[];

    constructor(options: { folder: string; resourceType?: 'image' | 'video' | 'auto'; allowedFormats?: string[] }) {
        this.folder = options.folder;
        this.resourceType = options.resourceType || 'image';
        this.allowedFormats = options.allowedFormats || ['jpg', 'png', 'jpeg'];
    }

    _handleFile(req: Request, file: Express.Multer.File, cb: (error?: any, info?: any) => void): void {
        const cleanName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, "_");
        const public_id = `${cleanName}_${Date.now()}`;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: this.folder,
                resource_type: this.resourceType,
                public_id: public_id,
                format: undefined,
            },
            (error, result) => {
                if (error) return cb(error);
                if (!result) return cb(new Error('Cloudinary upload failed - no result'));

                cb(null, {
                    path: result.secure_url,
                    filename: result.public_id,
                    size: result.bytes,
                    mimetype: result.format ? `${this.resourceType}/${result.format}` : file.mimetype
                });
            }
        );

        file.stream.pipe(uploadStream);
    }

    _removeFile(req: Request, file: Express.Multer.File, cb: (error: Error | null) => void): void {
        cloudinary.uploader.destroy(file.filename, { resource_type: this.resourceType }, (err) => {
            cb(err || null);
        });
    }
}

// 🟢 UPLOADERS (Strict English Naming)

export const uploadUserImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/users',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif']
    })
});

export const uploadGalleryImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/gallery',
        resourceType: 'auto',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov', 'webm']
    })
});

export const uploadMemberImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/members'
    })
});

export const uploadBlogImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/blog-posts'
    })
});

export const uploadAnnouncementImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/announcements'
    })
});

export const uploadChatImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/chats/images'
    })
});

export const uploadChatMedia = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/chats/media',
        resourceType: 'auto',
        allowedFormats: [
            'mp3', 'wav', 'mp4', 'mov', 'webm', 'm4a', 'aac', 'ogg',
            'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'
        ]
    })
});

export const uploadSongAudio = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/songs/audio',
        resourceType: 'video',
        allowedFormats: ['mp3', 'm4a', 'wav', 'aac']
    })
});

// Choir logos
export const uploadChoirLogo = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/choirs/logo',
        resourceType: 'image',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
    })
});

// Instrument icons
export const uploadInstrumentIcon = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/instruments/icons',
        resourceType: 'image',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp']
    })
});

const storage = multer.memoryStorage();
export const uploadChatFile = multer({ storage });

export const streamUpload = (
    buffer: Buffer,
    originalName: string,
    resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto'
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uniqueId = `chatfile_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
        const publicIdPath = `ero-cras-media/chats/files/${uniqueId}`;

        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: 'ero-cras-media/chats/files',
                public_id: publicIdPath,
            },
            (error: any, result: any) => {
                if (result) resolve(result);
                else reject(error);
            }
        );

        const { Readable } = require('stream');
        Readable.from(buffer).pipe(stream);
    });
};

// Generic delete helper (reusable for all models)
export const deleteFromCloudinary = (
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'
): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!publicId) {
            return resolve();
        }

        cloudinary.uploader.destroy(
            publicId,
            { resource_type: resourceType },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary delete error:', error);
                    return reject(error);
                }

                // result?.result can be 'ok', 'not found', etc.
                if (result && (result as any).result === 'ok') {
                    console.log(`Cloudinary: deleted ${publicId}`);
                } else {
                    console.log(`Cloudinary: delete response for ${publicId}:`, result);
                }

                resolve();
            }
        );
    });
};
