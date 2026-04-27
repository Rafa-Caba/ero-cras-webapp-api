// src/middlewares/cloudinaryStorage.ts

import { Request } from 'express';
import multer, { StorageEngine } from 'multer';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import type {
    UploadApiErrorResponse,
    UploadApiResponse,
} from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

type CloudinaryResourceType = 'image' | 'video' | 'auto';
type DestroyResourceType = 'image' | 'video' | 'raw' | 'auto';
type StreamUploadResourceType = 'auto' | 'image' | 'video' | 'raw';

interface CustomCloudinaryStorageOptions {
    folder: string;
    resourceType?: CloudinaryResourceType;
    allowedFormats?: string[];
}

interface CloudinaryDeleteResult {
    result?: string;
}

type MulterFileCallback = (
    error: Error | null,
    info?: Partial<Express.Multer.File>,
) => void;

const getFileExtension = (filename: string): string => {
    const filenameParts = filename.split('.');

    if (filenameParts.length <= 1) {
        return '';
    }

    const extension = filenameParts[filenameParts.length - 1];

    return extension.toLowerCase();
};

const getCleanBaseName = (filename: string): string => {
    const filenameWithoutExtension = filename.replace(/\.[^/.]+$/, '');

    return filenameWithoutExtension.replace(/[^a-zA-Z0-9]/g, '_');
};

class CustomCloudinaryStorage implements StorageEngine {
    private folder: string;
    private resourceType: CloudinaryResourceType;
    private allowedFormats: string[];

    constructor(options: CustomCloudinaryStorageOptions) {
        this.folder = options.folder;
        this.resourceType = options.resourceType || 'image';
        this.allowedFormats = options.allowedFormats || ['jpg', 'png', 'jpeg'];
    }

    _handleFile(
        req: Request,
        file: Express.Multer.File,
        cb: MulterFileCallback,
    ): void {
        const extension = getFileExtension(file.originalname);

        if (
            this.allowedFormats.length > 0 &&
            extension &&
            !this.allowedFormats.includes(extension)
        ) {
            cb(new Error(`File format .${extension} is not allowed`));
            return;
        }

        const cleanName = getCleanBaseName(file.originalname);
        const publicId = `${cleanName}_${Date.now()}`;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: this.folder,
                resource_type: this.resourceType,
                public_id: publicId,
                format: undefined,
            },
            (
                error: UploadApiErrorResponse | undefined,
                result: UploadApiResponse | undefined,
            ) => {
                if (error) {
                    cb(error);
                    return;
                }

                if (!result) {
                    cb(new Error('Cloudinary upload failed - no result'));
                    return;
                }

                cb(null, {
                    path: result.secure_url,
                    filename: result.public_id,
                    size: result.bytes,
                    mimetype: result.format
                        ? `${this.resourceType}/${result.format}`
                        : file.mimetype,
                });
            },
        );

        file.stream.pipe(uploadStream);
    }

    _removeFile(
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null) => void,
    ): void {
        cloudinary.uploader.destroy(
            file.filename,
            { resource_type: this.resourceType },
            (error: UploadApiErrorResponse | undefined) => {
                cb(error || null);
            },
        );
    }
}

export const uploadUserImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/users',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif'],
    }),
});

export const uploadGalleryImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/gallery',
        resourceType: 'auto',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov', 'webm'],
    }),
});

export const uploadMemberImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/members',
    }),
});

export const uploadBlogImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/blog-posts',
    }),
});

export const uploadAnnouncementImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/announcements',
    }),
});

export const uploadChatImage = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/chats/images',
        resourceType: 'image',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    }),
});

export const uploadChatMedia = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/chats/media',
        resourceType: 'auto',
        allowedFormats: [
            'mp3',
            'wav',
            'mp4',
            'mov',
            'webm',
            'm4a',
            'aac',
            'ogg',
            'pdf',
            'doc',
            'docx',
            'txt',
            'xls',
            'xlsx',
            'ppt',
            'pptx',
        ],
    }),
});

export const uploadSongAudio = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/songs/audio',
        resourceType: 'video',
        allowedFormats: ['mp3', 'm4a', 'wav', 'aac'],
    }),
});

export const uploadChoirLogo = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/choirs/logo',
        resourceType: 'image',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    }),
});

export const uploadInstrumentIcon = multer({
    storage: new CustomCloudinaryStorage({
        folder: 'ero-cras-media/instruments/icons',
        resourceType: 'image',
        allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    }),
});

const chatFileStorage = multer.memoryStorage();

export const uploadChatFile = multer({
    storage: chatFileStorage,
});

export const streamUpload = (
    buffer: Buffer,
    originalName: string,
    resourceType: StreamUploadResourceType = 'auto',
): Promise<UploadApiResponse> => {
    return new Promise<UploadApiResponse>((resolve, reject) => {
        const cleanName = getCleanBaseName(originalName);
        const publicId = `${cleanName}_${Date.now()}`;

        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: 'ero-cras-media/chats/files',
                public_id: publicId,
            },
            (
                error: UploadApiErrorResponse | undefined,
                result: UploadApiResponse | undefined,
            ) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!result) {
                    reject(new Error('Cloudinary upload failed - no result'));
                    return;
                }

                resolve(result);
            },
        );

        Readable.from(buffer).pipe(stream);
    });
};

export const deleteFromCloudinary = (
    publicId: string,
    resourceType: DestroyResourceType = 'image',
): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        if (!publicId) {
            resolve();
            return;
        }

        cloudinary.uploader.destroy(
            publicId,
            { resource_type: resourceType },
            (
                error: UploadApiErrorResponse | undefined,
                result: CloudinaryDeleteResult | undefined,
            ) => {
                if (error) {
                    console.error('Cloudinary delete error:', error);
                    reject(error);
                    return;
                }

                if (result?.result === 'ok') {
                    console.log(`Cloudinary: deleted ${publicId}`);
                } else {
                    console.log(`Cloudinary: delete response for ${publicId}:`, result);
                }

                resolve();
            },
        );
    });
};