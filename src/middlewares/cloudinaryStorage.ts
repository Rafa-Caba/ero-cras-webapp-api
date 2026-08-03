// src/middlewares/cloudinaryStorage.ts

import type { Request } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError';

interface AllowedFileType {
    readonly mimeType: string;
    readonly extensions: readonly string[];
}

interface UploadPolicy {
    readonly allowedFileTypes: readonly AllowedFileType[];
    readonly maxFileSizeBytes: number;
}

const extensionOf = (filename: string): string => {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
};

const createUpload = (policy: UploadPolicy) => multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: policy.maxFileSizeBytes, files: 1 },
    fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        callback: multer.FileFilterCallback
    ): void => {
        const extension = extensionOf(file.originalname);
        const allowedType = policy.allowedFileTypes.find(
            (candidate) => candidate.mimeType === file.mimetype.toLowerCase()
        );
        const validPair = allowedType?.extensions.includes(extension) ?? false;

        if (!validPair) {
            callback(new AppError(
                400,
                'INVALID_MEDIA_FILE',
                'The uploaded MIME type and file extension are not an allowed pair'
            ));
            return;
        }

        callback(null, true);
    }
});

const IMAGE_FILE_TYPES: readonly AllowedFileType[] = [
    { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
    { mimeType: 'image/png', extensions: ['png'] },
    { mimeType: 'image/gif', extensions: ['gif'] },
    { mimeType: 'image/webp', extensions: ['webp'] }
];

const AUDIO_FILE_TYPES: readonly AllowedFileType[] = [
    { mimeType: 'audio/mpeg', extensions: ['mp3'] },
    { mimeType: 'audio/mp4', extensions: ['m4a'] },
    { mimeType: 'audio/x-m4a', extensions: ['m4a'] },
    { mimeType: 'audio/wav', extensions: ['wav'] },
    { mimeType: 'audio/x-wav', extensions: ['wav'] },
    { mimeType: 'audio/aac', extensions: ['aac'] },
    { mimeType: 'audio/ogg', extensions: ['ogg'] }
];

const VIDEO_FILE_TYPES: readonly AllowedFileType[] = [
    { mimeType: 'video/mp4', extensions: ['mp4'] },
    { mimeType: 'video/quicktime', extensions: ['mov'] },
    { mimeType: 'video/webm', extensions: ['webm'] }
];

const DOCUMENT_FILE_TYPES: readonly AllowedFileType[] = [
    { mimeType: 'application/pdf', extensions: ['pdf'] },
    { mimeType: 'text/plain', extensions: ['txt'] },
    { mimeType: 'application/msword', extensions: ['doc'] },
    {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: ['docx']
    },
    { mimeType: 'application/vnd.ms-excel', extensions: ['xls'] },
    {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extensions: ['xlsx']
    },
    { mimeType: 'application/vnd.ms-powerpoint', extensions: ['ppt'] },
    {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extensions: ['pptx']
    }
];

export const uploadUserImage = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 20 * 1024 * 1024
});

export const uploadMemberImage = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 10 * 1024 * 1024
});

export const uploadBlogImage = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 10 * 1024 * 1024
});

export const uploadAnnouncementImage = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 10 * 1024 * 1024
});

export const uploadChoirLogo = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 10 * 1024 * 1024
});

export const uploadSettingsLogo = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 10 * 1024 * 1024
});

export const uploadInstrumentIcon = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 5 * 1024 * 1024
});

export const uploadGalleryImage = createUpload({
    allowedFileTypes: [...IMAGE_FILE_TYPES, ...VIDEO_FILE_TYPES],
    maxFileSizeBytes: 100 * 1024 * 1024
});

export const uploadChatImage = createUpload({
    allowedFileTypes: IMAGE_FILE_TYPES,
    maxFileSizeBytes: 20 * 1024 * 1024
});

export const uploadChatMedia = createUpload({
    allowedFileTypes: [...AUDIO_FILE_TYPES, ...VIDEO_FILE_TYPES],
    maxFileSizeBytes: 50 * 1024 * 1024
});

export const uploadChatFile = createUpload({
    allowedFileTypes: DOCUMENT_FILE_TYPES,
    maxFileSizeBytes: 20 * 1024 * 1024
});

export const uploadSongAudio = createUpload({
    allowedFileTypes: AUDIO_FILE_TYPES.filter(
        (fileType) => fileType.mimeType !== 'audio/ogg'
    ),
    maxFileSizeBytes: 50 * 1024 * 1024
});
