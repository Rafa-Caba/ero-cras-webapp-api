// src/controllers/gallery.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import GalleryImage, { type IGalleryImage } from '../models/GalleryImage';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import { sendCacheableJson } from '../services/httpCache.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import {
    parseObjectId,
    parseRequestBody,
    readOptionalBoolean
} from '../validations/schemas/common.schemas';
import { parseGalleryInput } from '../validations/schemas/resource.schemas';

interface ResourceParams {
    readonly id: string;
    readonly field?: string;
}

type GalleryMarkerField = keyof Pick<
    IGalleryImage,
    | 'imageStart'
    | 'imageTopBar'
    | 'imageUs'
    | 'imageLogo'
    | 'imageGallery'
    | 'imageLeftMenu'
    | 'imageRightMenu'
>;

const MARKABLE_FIELDS: readonly GalleryMarkerField[] = [
    'imageStart',
    'imageTopBar',
    'imageUs',
    'imageLogo',
    'imageGallery',
    'imageLeftMenu',
    'imageRightMenu'
];

const findImage = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IGalleryImage> => {
    return GalleryImage
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'GALLERY_IMAGE_NOT_FOUND',
            'Gallery image not found'
        ))
        .exec();
};

export const listGalleryController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const images = await GalleryImage.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username')
        .sort({ createdAt: -1 });

    sendCacheableJson(req, res, images);
};

export const getGalleryImageController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    res.json(await findImage(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    ));
};

export const createGalleryImageController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    if (!req.file) {
        throw new AppError(
            400,
            'GALLERY_FILE_REQUIRED',
            'A gallery file is required'
        );
    }

    const input = parseGalleryInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const imageId = new Types.ObjectId();
    const uploaded = await uploadTenantMedia({
        file: req.file,
        choirId,
        actorUserId,
        ownerType: 'GALLERY',
        category: 'gallery'
    });
    const detectedMediaType = uploaded.asset.mimeType.startsWith('video/')
        ? 'VIDEO'
        : 'IMAGE';

    if (input.mediaType !== detectedMediaType) {
        await discardPendingMedia(
            uploaded.asset._id,
            choirId,
            'Gallery media type mismatch'
        );
        throw new AppError(
            400,
            'GALLERY_MEDIA_TYPE_MISMATCH',
            'mediaType does not match the uploaded file'
        );
    }

    const image = await GalleryImage.create({
        _id: imageId,
        ...input,
        imageUrl: uploaded.media.url,
        imagePublicId: uploaded.media.publicId,
        mediaResourceType: uploaded.media.resourceType,
        mediaAssetId: uploaded.asset._id,
        choirId,
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        await discardPendingMedia(
            uploaded.asset._id,
            choirId,
            'Gallery creation failed'
        );
        throw error;
    });

    await attachMediaAsset(
        uploaded.asset._id,
        choirId,
        'GALLERY',
        image._id
    );

    await registerLog({
        req,
        collection: 'GalleryImages',
        action: 'create',
        referenceId: image.id,
        changes: { after: image.toObject() }
    });

    res.status(201).json(image);
};

export const updateGalleryImageController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const image = await findImage(req.params.id, choirId);
    const before = image.toObject();
    const input = parseGalleryInput(req);
    const previousAssetId = image.mediaAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'GALLERY',
            category: 'gallery'
        })
        : null;

    if (uploaded) {
        const detectedMediaType = uploaded.asset.mimeType.startsWith('video/')
            ? 'VIDEO'
            : 'IMAGE';

        if (input.mediaType !== detectedMediaType) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Gallery media type mismatch'
            );
            throw new AppError(
                400,
                'GALLERY_MEDIA_TYPE_MISMATCH',
                'mediaType does not match the uploaded file'
            );
        }

        image.imageUrl = uploaded.media.url;
        image.imagePublicId = uploaded.media.publicId;
        image.mediaResourceType = uploaded.media.resourceType;
        image.mediaAssetId = uploaded.asset._id;
    }

    image.title = input.title;
    image.description = input.description;
    image.mediaType = input.mediaType;
    image.imageStart = input.imageStart;
    image.imageTopBar = input.imageTopBar;
    image.imageUs = input.imageUs;
    image.imageLogo = input.imageLogo;
    image.imageGallery = input.imageGallery;
    image.imageLeftMenu = input.imageLeftMenu;
    image.imageRightMenu = input.imageRightMenu;
    image.updatedBy = actorUserId;

    await image.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Gallery update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'GALLERY', image._id);
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'GALLERY',
            ownerId: image._id
        });
    }

    await registerLog({
        req,
        collection: 'GalleryImages',
        action: 'update',
        referenceId: image.id,
        changes: { before, after: image.toObject() }
    });

    res.json(image);
};

export const markGalleryImageController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const field = MARKABLE_FIELDS.find((item) => item === req.params.field);

    if (!field) {
        throw new AppError(
            400,
            'INVALID_GALLERY_FIELD',
            'Unsupported gallery marker field'
        );
    }

    const choirId = requireEffectiveChoirObjectId(req);
    const image = await findImage(req.params.id, choirId);
    const value = readOptionalBoolean(parseRequestBody(req), 'value') ?? true;

    if (value && field !== 'imageGallery') {
        await GalleryImage.updateMany(
            { choirId, [field]: true, _id: { $ne: image._id } },
            { $set: { [field]: false } }
        );
    }

    image.set(field, value);
    image.updatedBy = requireAuthenticatedUserId(req);
    await image.save();
    res.json(image);
};

export const deleteGalleryImageController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const image = await findImage(req.params.id, choirId);
    const before = image.toObject();
    const assetId = image.mediaAssetId;
    await image.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'GALLERY',
        ownerId: image._id
    });

    await registerLog({
        req,
        collection: 'GalleryImages',
        action: 'delete',
        referenceId: image.id,
        changes: { before }
    });

    res.json({ message: 'Gallery image deleted successfully' });
};
