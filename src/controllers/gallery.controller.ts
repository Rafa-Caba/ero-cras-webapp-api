// src/controllers/gallery.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import GalleryImage, { type IGalleryImage } from '../models/GalleryImage';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { resolvePublicChoirId } from '../services/publicChoir.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import { parseGalleryInput } from '../validations/schemas/resource.schemas';
import {
    parseObjectId,
    parseRequestBody,
    readOptionalBoolean
} from '../validations/schemas/common.schemas';

interface ResourceParams {
    readonly id: string;
    readonly choirKey?: string;
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
        .orFail(() =>
            createTenantResourceNotFoundError(
                'GALLERY_IMAGE_NOT_FOUND',
                'Gallery image not found'
            )
        )
        .exec();
};

export const listPublicGalleryController = async (
    req: Request<ResourceParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const images = await GalleryImage.find({ choirId })
        .select('-imagePublicId -updatedBy')
        .sort({ createdAt: -1 });
    res.json(images);
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
    res.json(images);
};

export const getGalleryImageController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const image = await findImage(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(image);
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

    const image = await GalleryImage.create({
        ...parseGalleryInput(req),
        imageUrl: req.file.path,
        imagePublicId: req.file.filename,
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

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
    const image = await findImage(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = image.toObject();
    const input = parseGalleryInput(req);

    if (req.file) {
        await deleteFromCloudinary(
            image.imagePublicId ?? '',
            image.mediaType === 'VIDEO' ? 'video' : 'image'
        );
        image.imageUrl = req.file.path;
        image.imagePublicId = req.file.filename;
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
    image.updatedBy = requireAuthenticatedUserId(req);
    await image.save();

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
    const image = await findImage(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = image.toObject();
    await deleteFromCloudinary(
        image.imagePublicId ?? '',
        image.mediaType === 'VIDEO' ? 'video' : 'image'
    );
    await image.deleteOne();

    await registerLog({
        req,
        collection: 'GalleryImages',
        action: 'delete',
        referenceId: image.id,
        changes: { before }
    });

    res.json({ message: 'Gallery image deleted successfully' });
};
