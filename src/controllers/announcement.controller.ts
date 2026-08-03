// src/controllers/announcement.controller.ts

import type { Response } from 'express';
import { deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import Announcement, { type IAnnouncement } from '../models/Announcement';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import { parseAnnouncementInput } from '../validations/schemas/resource.schemas';
import { parseObjectId } from '../validations/schemas/common.schemas';

interface ResourceParams {
    readonly id: string;
}

const findAnnouncement = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IAnnouncement> => {
    return Announcement
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'ANNOUNCEMENT_NOT_FOUND',
                'Announcement not found'
            )
        )
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
    const announcement = await findAnnouncement(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(announcement);
};

export const createAnnouncementController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseAnnouncementInput(req);
    const announcement = await Announcement.create({
        ...input,
        imageUrl: req.file?.path ?? '',
        imagePublicId: req.file?.filename ?? null,
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

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
    const announcement = await findAnnouncement(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = announcement.toObject();
    const input = parseAnnouncementInput(req);

    if (req.file) {
        await deleteFromCloudinary(announcement.imagePublicId ?? '');
        announcement.imageUrl = req.file.path;
        announcement.imagePublicId = req.file.filename;
    }

    announcement.title = input.title;
    announcement.content = input.content;
    announcement.isPublic = input.isPublic;
    announcement.updatedBy = requireAuthenticatedUserId(req);
    await announcement.save();

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
    const announcement = await findAnnouncement(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = announcement.toObject();
    await deleteFromCloudinary(announcement.imagePublicId ?? '');
    await announcement.deleteOne();

    await registerLog({
        req,
        collection: 'Announcements',
        action: 'delete',
        referenceId: announcement.id,
        changes: { before }
    });

    res.json({ message: 'Announcement deleted successfully' });
};
