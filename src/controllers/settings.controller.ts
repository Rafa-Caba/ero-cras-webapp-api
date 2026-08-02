// src/controllers/settings.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import {
    deleteFromCloudinary
} from '../middlewares/cloudinaryStorage';
import Settings from '../models/Settings';
import { resolvePublicChoirId } from '../services/publicChoir.service';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseSettingsInput } from '../validations/schemas/resource.schemas';

interface PublicSettingsParams {
    readonly choirKey?: string;
}

const requireSettings = async (choirId: ReturnType<typeof requireEffectiveChoirObjectId>) => {
    const settings = await Settings.findOne({ choirId });

    if (!settings) {
        throw new AppError(404, 'SETTINGS_NOT_FOUND', 'Settings not found');
    }

    return settings;
};

export const getPublicSettingsController = async (
    req: Request<PublicSettingsParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const settings = await Settings.findOne({ choirId })
        .select('-logoPublicId -createdBy -updatedBy');

    if (!settings) {
        throw new AppError(404, 'SETTINGS_NOT_FOUND', 'Settings not found');
    }

    res.json(settings);
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

    if (input.webTitle !== undefined) {
        settings.webTitle = input.webTitle;
    }

    if (input.contactPhone !== undefined) {
        settings.contactPhone = input.contactPhone;
    }

    if (input.socials !== undefined) {
        settings.socials = input.socials;
    }

    if (input.homeLegends !== undefined) {
        settings.homeLegends = input.homeLegends;
    }

    if (input.history !== undefined) {
        settings.history = input.history;
    }

    if (req.file) {
        await deleteFromCloudinary(settings.logoPublicId ?? '');
        settings.logoUrl = req.file.path;
        settings.logoPublicId = req.file.filename;
    }

    settings.updatedBy = actorUserId;
    await settings.save();

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
