// src/controllers/settings.controller.ts

import type { Response } from 'express';
import { AppError } from '../errors/AppError';
import Settings from '../models/Settings';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseSettingsInput } from '../validations/schemas/resource.schemas';

const requireSettings = async (
    choirId: ReturnType<typeof requireEffectiveChoirObjectId>
) => {
    const settings = await Settings.findOne({ choirId });

    if (!settings) {
        throw new AppError(404, 'SETTINGS_NOT_FOUND', 'Settings not found');
    }

    return settings;
};

export const getSettingsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const settings = await requireSettings(requireEffectiveChoirObjectId(req));
    await settings.populate([
        { path: 'createdBy', select: 'name username' },
        { path: 'updatedBy', select: 'name username' }
    ]);
    res.json(settings);
};

export const updateSettingsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const input = parseSettingsInput(req);
    let settings = await Settings.findOne({ choirId });
    const before = settings?.toObject() ?? null;

    if (!settings) {
        settings = new Settings({
            choirId,
            createdBy: actorUserId,
            history: { type: 'doc', content: [] }
        });
    }

    const previousAssetId = settings.logoAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'SETTINGS',
            category: 'settings-logo'
        })
        : null;

    if (input.webTitle !== undefined) settings.webTitle = input.webTitle;
    if (input.contactPhone !== undefined) settings.contactPhone = input.contactPhone;
    if (input.socials !== undefined) settings.socials = input.socials;
    if (input.homeLegends !== undefined) settings.homeLegends = input.homeLegends;
    if (input.history !== undefined) settings.history = input.history;

    if (uploaded) {
        settings.logoUrl = uploaded.media.url;
        settings.logoPublicId = uploaded.media.publicId;
        settings.logoResourceType = uploaded.media.resourceType;
        settings.logoAssetId = uploaded.asset._id;
    }

    settings.updatedBy = actorUserId;
    await settings.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Settings update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'SETTINGS',
            settings._id
        );
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'SETTINGS',
            ownerId: settings._id
        });
    }

    await registerLog({
        req,
        collection: 'Settings',
        action: before ? 'update' : 'create',
        referenceId: settings.id,
        changes: { before, after: settings.toObject() }
    });

    await settings.populate([
        { path: 'createdBy', select: 'name username' },
        { path: 'updatedBy', select: 'name username' }
    ]);
    res.json(settings);
};
