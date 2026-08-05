// src/services/media.service.ts

import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import type {
    UploadApiErrorResponse,
    UploadApiResponse
} from 'cloudinary';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import MediaAsset, { type IMediaAsset } from '../models/MediaAsset';
import type {
    MediaOwnerType,
    MediaResourceType,
    MediaUploadCategory,
    UploadedMediaReference
} from '../types/media.types';
import cloudinary from '../utils/cloudinary';

interface UploadMediaInput {
    readonly file: Express.Multer.File;
    readonly choirId: Types.ObjectId;
    readonly actorUserId: Types.ObjectId;
    readonly ownerType: MediaOwnerType;
    readonly category: MediaUploadCategory;
}

interface DeleteMediaInput {
    readonly assetId: Types.ObjectId | string | null | undefined;
    readonly choirId: Types.ObjectId;
    readonly ownerType: MediaOwnerType;
    readonly ownerId: Types.ObjectId;
}

const STALE_PENDING_MEDIA_MS = 60 * 60 * 1000;
const MAX_ORIGINAL_NAME_LENGTH = 255;
const MAX_PUBLIC_ID_BASE_LENGTH = 80;

const extensionOf = (filename: string): string => {
    const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] ?? '';
};

const cleanBaseName = (filename: string): string => {
    const withoutExtension = filename.replace(/\.[^/.]+$/, '');
    const cleaned = withoutExtension
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, MAX_PUBLIC_ID_BASE_LENGTH);
    return cleaned || 'upload';
};

const folderFor = (
    choirId: Types.ObjectId,
    category: MediaUploadCategory
): string => {
    const choir = choirId.toString();

    if (category === 'choir-logo' || category === 'settings-logo') {
        return `${env.cloudinary.baseFolder}/platform/choirs/${choir}/logo`;
    }

    return `${env.cloudinary.baseFolder}/choirs/${choir}/${category}`;
};

const requestedResourceType = (
    mimeType: string
): MediaResourceType => {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }

    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        return 'video';
    }

    return 'raw';
};

const normalizeResourceType = (
    resourceType: string
): MediaResourceType => {
    if (resourceType === 'video' || resourceType === 'raw') {
        return resourceType;
    }

    return 'image';
};

const createPublicId = (
    file: Express.Multer.File,
    resourceType: MediaResourceType
): string => {
    const base = `${cleanBaseName(file.originalname)}_${randomUUID()}`;
    const extension = extensionOf(file.originalname);

    if (resourceType === 'raw' && extension) {
        return `${base}.${extension}`;
    }

    return base;
};

const toCloudinaryUploadError = (
    error: UploadApiErrorResponse
): AppError => {
    const message = error.message?.trim() || 'Cloudinary rejected the uploaded media';

    if (error.http_code === 400 || message.toLowerCase().includes('empty file')) {
        return new AppError(
            400,
            'INVALID_MEDIA_FILE',
            message.toLowerCase().includes('empty file')
                ? 'The uploaded file is empty'
                : message
        );
    }

    return new AppError(
        502,
        'MEDIA_PROVIDER_ERROR',
        'The media provider could not process the uploaded file'
    );
};

const assertUploadBuffer = (file: Express.Multer.File): void => {
    if (file.size <= 0 || file.buffer.length <= 0) {
        throw new AppError(
            400,
            'EMPTY_MEDIA_FILE',
            'The uploaded file is empty'
        );
    }
};

const uploadBuffer = (
    file: Express.Multer.File,
    folder: string
): Promise<UploadApiResponse> => {
    assertUploadBuffer(file);

    return new Promise<UploadApiResponse>((resolve, reject) => {
        const resourceType = requestedResourceType(file.mimetype);
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: createPublicId(file, resourceType),
                resource_type: resourceType
            },
            (
                error: UploadApiErrorResponse | undefined,
                result: UploadApiResponse | undefined
            ) => {
                if (error) {
                    reject(toCloudinaryUploadError(error));
                    return;
                }

                if (!result) {
                    reject(new AppError(
                        502,
                        'MEDIA_PROVIDER_EMPTY_RESPONSE',
                        'The media provider returned no upload result'
                    ));
                    return;
                }

                resolve(result);
            }
        );

        stream.end(file.buffer);
    });
};


export interface PlatformProfileMediaReference {
    readonly url: string;
    readonly publicId: string;
    readonly resourceType: MediaResourceType;
}

export const uploadPlatformProfileMedia = async (
    file: Express.Multer.File,
    userId: Types.ObjectId
): Promise<PlatformProfileMediaReference> => {
    const result = await uploadBuffer(
        file,
        `${env.cloudinary.baseFolder}/platform/users/${userId.toString()}/profile`
    );

    return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: normalizeResourceType(result.resource_type)
    };
};

export const deleteCloudinaryMedia = async (
    publicId: string,
    resourceType: MediaResourceType
): Promise<void> => {
    await destroyCloudinaryResource(publicId, resourceType);
};

const destroyCloudinaryResource = async (
    publicId: string,
    resourceType: MediaResourceType
): Promise<void> => {
    await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true
    });
};

const parseAssetId = (
    assetId: Types.ObjectId | string,
    fieldName = 'assetId'
): Types.ObjectId => {
    if (assetId instanceof Types.ObjectId) {
        return assetId;
    }

    if (!Types.ObjectId.isValid(assetId)) {
        throw new AppError(
            400,
            'INVALID_MEDIA_ASSET_ID',
            `${fieldName} must be a valid MongoDB ObjectId`
        );
    }

    return new Types.ObjectId(assetId);
};

export const uploadTenantMedia = async (
    input: UploadMediaInput
): Promise<{
    readonly asset: IMediaAsset;
    readonly media: UploadedMediaReference;
}> => {
    const result = await uploadBuffer(
        input.file,
        folderFor(input.choirId, input.category)
    );
    const resourceType = normalizeResourceType(result.resource_type);
    const fallbackFormat = extensionOf(input.file.originalname) || resourceType;

    const asset = await MediaAsset.create({
        choirId: input.choirId,
        uploadedBy: input.actorUserId,
        ownerType: input.ownerType,
        ownerId: null,
        publicId: result.public_id,
        resourceType,
        url: result.secure_url,
        bytes: result.bytes,
        format: result.format ?? fallbackFormat,
        originalName: input.file.originalname.slice(0, MAX_ORIGINAL_NAME_LENGTH),
        mimeType: input.file.mimetype.toLowerCase(),
        status: 'PENDING'
    }).catch(async (error: Error) => {
        await destroyCloudinaryResource(result.public_id, resourceType);
        throw error;
    });

    return {
        asset,
        media: {
            assetId: asset.id,
            url: asset.url,
            publicId: asset.publicId,
            resourceType: asset.resourceType,
            bytes: asset.bytes,
            format: asset.format
        }
    };
};

export const getPendingMediaAsset = async (
    assetId: string,
    choirId: Types.ObjectId,
    uploadedBy: Types.ObjectId,
    ownerType: MediaOwnerType
): Promise<IMediaAsset> => {
    const asset = await MediaAsset.findOne({
        _id: parseAssetId(assetId),
        choirId,
        uploadedBy,
        ownerType,
        status: 'PENDING'
    });

    if (!asset) {
        throw new AppError(
            404,
            'PENDING_MEDIA_NOT_FOUND',
            'The pending media asset was not found for this user and choir'
        );
    }

    return asset;
};

export const attachMediaAsset = async (
    assetId: Types.ObjectId | string,
    choirId: Types.ObjectId,
    ownerType: MediaOwnerType,
    ownerId: Types.ObjectId
): Promise<void> => {
    const updated = await MediaAsset.findOneAndUpdate(
        {
            _id: parseAssetId(assetId),
            choirId,
            ownerType,
            status: 'PENDING'
        },
        {
            $set: {
                ownerId,
                status: 'ATTACHED',
                attachedAt: new Date(),
                orphanedReason: ''
            }
        },
        { new: true }
    );

    if (!updated) {
        throw new AppError(
            409,
            'MEDIA_ATTACHMENT_FAILED',
            'The uploaded media could not be attached to the resource'
        );
    }
};

export const discardPendingMedia = async (
    assetId: Types.ObjectId | string,
    choirId: Types.ObjectId,
    reason: string
): Promise<void> => {
    const asset = await MediaAsset.findOne({
        _id: parseAssetId(assetId),
        choirId,
        status: 'PENDING'
    });

    if (!asset) {
        return;
    }

    await destroyCloudinaryResource(asset.publicId, asset.resourceType)
        .then(async () => {
            asset.status = 'DELETED';
            asset.deletedAt = new Date();
            asset.orphanedReason = reason;
            await asset.save();
        })
        .catch(async () => {
            asset.status = 'ORPHANED';
            asset.orphanedReason = reason;
            await asset.save();
        });
};

export const deleteOwnedMedia = async (
    input: DeleteMediaInput
): Promise<void> => {
    if (!input.assetId) {
        return;
    }

    const asset = await MediaAsset.findOne({
        _id: parseAssetId(input.assetId),
        choirId: input.choirId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        status: { $in: ['ATTACHED', 'ORPHANED'] }
    });

    if (!asset) {
        throw new AppError(
            404,
            'MEDIA_ASSET_NOT_FOUND',
            'The media asset was not found for this choir and resource'
        );
    }

    await destroyCloudinaryResource(asset.publicId, asset.resourceType)
        .then(async () => {
            asset.status = 'DELETED';
            asset.deletedAt = new Date();
            asset.orphanedReason = '';
            await asset.save();
        })
        .catch(async () => {
            asset.status = 'ORPHANED';
            asset.orphanedReason = 'Cloudinary deletion failed';
            await asset.save();
        });
};

export const listOrphanedMedia = async (
    choirId: Types.ObjectId
): Promise<readonly IMediaAsset[]> => {
    const pendingThreshold = new Date(Date.now() - STALE_PENDING_MEDIA_MS);

    return MediaAsset.find({
        choirId,
        $or: [
            { status: 'ORPHANED' },
            { status: 'PENDING', createdAt: { $lt: pendingThreshold } }
        ]
    }).sort({ createdAt: 1 });
};

export const cleanupOrphanedMedia = async (
    assetId: string,
    choirId: Types.ObjectId
): Promise<IMediaAsset> => {
    const pendingThreshold = new Date(Date.now() - STALE_PENDING_MEDIA_MS);
    const asset = await MediaAsset.findOne({
        _id: parseAssetId(assetId),
        choirId,
        $or: [
            { status: 'ORPHANED' },
            { status: 'PENDING', createdAt: { $lt: pendingThreshold } }
        ]
    });

    if (!asset) {
        throw new AppError(
            404,
            'ORPHANED_MEDIA_NOT_FOUND',
            'The orphaned or stale pending media asset was not found in this choir'
        );
    }

    await destroyCloudinaryResource(asset.publicId, asset.resourceType);
    asset.status = 'DELETED';
    asset.deletedAt = new Date();
    asset.orphanedReason = '';
    await asset.save();
    return asset;
};
