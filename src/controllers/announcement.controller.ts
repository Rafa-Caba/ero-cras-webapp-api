// src/controllers/announcement.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import Announcement, { type IAnnouncement } from '../models/Announcement';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseAnnouncementInput } from '../validations/schemas/resource.schemas';

interface ResourceParams {
    readonly id: string;
}

const findAnnouncement = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IAnnouncement> => {
    return Announcement
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'ANNOUNCEMENT_NOT_FOUND',
            'Announcement not found'
        ))
        .exec();
};

export const listAnnouncementsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const announcements = await Announcement.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username')
        .sort({ createdAt: -1 });
    res.json(announcements);
};

export const getAnnouncementController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    res.json(await findAnnouncement(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    ));
};

export const createAnnouncementController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseAnnouncementInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const announcementId = new Types.ObjectId();
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'ANNOUNCEMENT',
            category: 'announcements'
        })
        : null;

    const announcement = await Announcement.create({
        _id: announcementId,
        ...input,
        imageUrl: uploaded?.media.url ?? '',
        imagePublicId: uploaded?.media.publicId ?? null,
        imageResourceType: uploaded?.media.resourceType ?? null,
        imageAssetId: uploaded?.asset._id ?? null,
        choirId,
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Announcement creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'ANNOUNCEMENT',
            announcement._id
        );
    }

    await registerLog({
        req,
        collection: 'Announcements',
        action: 'create',
        referenceId: announcement.id,
        changes: { after: announcement.toObject() }
    });

    if (announcement.isPublic) {
        await notifyCommunity(
            requireEffectiveChoirId(req),
            req.user?.id,
            req.user?.name ?? '',
            'ANNOUNCEMENT',
            announcement
        );
    }

    res.status(201).json(announcement);
};

export const updateAnnouncementController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const announcement = await findAnnouncement(req.params.id, choirId);
    const before = announcement.toObject();
    const input = parseAnnouncementInput(req);
    const previousAssetId = announcement.imageAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'ANNOUNCEMENT',
            category: 'announcements'
        })
        : null;

    announcement.title = input.title;
    announcement.content = input.content;
    announcement.isPublic = input.isPublic;
    announcement.updatedBy = actorUserId;

    if (uploaded) {
        announcement.imageUrl = uploaded.media.url;
        announcement.imagePublicId = uploaded.media.publicId;
        announcement.imageResourceType = uploaded.media.resourceType;
        announcement.imageAssetId = uploaded.asset._id;
    }

    await announcement.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Announcement update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'ANNOUNCEMENT',
            announcement._id
        );
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'ANNOUNCEMENT',
            ownerId: announcement._id
        });
    }

    await registerLog({
        req,
        collection: 'Announcements',
        action: 'update',
        referenceId: announcement.id,
        changes: { before, after: announcement.toObject() }
    });

    res.json(announcement);
};

export const deleteAnnouncementController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const announcement = await findAnnouncement(req.params.id, choirId);
    const before = announcement.toObject();
    const assetId = announcement.imageAssetId;
    await announcement.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'ANNOUNCEMENT',
        ownerId: announcement._id
    });

    await registerLog({
        req,
        collection: 'Announcements',
        action: 'delete',
        referenceId: announcement.id,
        changes: { before }
    });

    res.json({ message: 'Announcement deleted successfully' });
};
