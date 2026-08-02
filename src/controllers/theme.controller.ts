// src/controllers/theme.controller.ts

import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import Theme, { type ITheme } from '../models/Theme';
import User from '../models/User';
import { resolvePublicChoirId } from '../services/publicChoir.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseThemeInput } from '../validations/schemas/resource.schemas';

interface ThemeParams {
    readonly id: string;
    readonly choirKey?: string;
}

const findTheme = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<ITheme> => {
    return Theme
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'THEME_NOT_FOUND',
                'Theme not found'
            )
        )
        .exec();
};

export const listPublicThemesController = async (
    req: Request<ThemeParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const themes = await Theme.find({ choirId })
        .select('-createdBy -updatedBy')
        .sort({ name: 1 });
    res.json(themes);
};

export const listThemesController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const themes = await Theme.find({
        choirId: requireEffectiveChoirObjectId(req)
    }).sort({ name: 1 });
    res.json(themes);
};

export const getThemeController = async (
    req: RequestWithUser & { params: ThemeParams },
    res: Response
): Promise<void> => {
    const theme = await findTheme(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(theme);
};

export const createThemeController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const theme = await Theme.create({
        ...parseThemeInput(req),
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

    await registerLog({
        req,
        collection: 'Themes',
        action: 'create',
        referenceId: theme.id,
        changes: { after: theme.toObject() }
    });

    res.status(201).json(theme);
};

export const updateThemeController = async (
    req: RequestWithUser & { params: ThemeParams },
    res: Response
): Promise<void> => {
    const theme = await findTheme(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = theme.toObject();
    const input = parseThemeInput(req);

    theme.name = input.name;
    theme.isDark = input.isDark;
    theme.primaryColor = input.primaryColor;
    theme.accentColor = input.accentColor;
    theme.backgroundColor = input.backgroundColor;
    theme.textColor = input.textColor;
    theme.cardColor = input.cardColor;
    theme.buttonColor = input.buttonColor;
    theme.navColor = input.navColor;
    theme.buttonTextColor = input.buttonTextColor;
    theme.secondaryTextColor = input.secondaryTextColor;
    theme.borderColor = input.borderColor;
    theme.updatedBy = requireAuthenticatedUserId(req);
    await theme.save();

    await registerLog({
        req,
        collection: 'Themes',
        action: 'update',
        referenceId: theme.id,
        changes: { before, after: theme.toObject() }
    });

    res.json(theme);
};

export const deleteThemeController = async (
    req: RequestWithUser & { params: ThemeParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const theme = await findTheme(req.params.id, choirId);
    const isInUse = await User.exists({ choirId, themeId: theme._id });

    if (isInUse) {
        throw new AppError(
            409,
            'THEME_IN_USE',
            'The theme cannot be deleted while it is assigned to users'
        );
    }

    const before = theme.toObject();
    await theme.deleteOne();

    await registerLog({
        req,
        collection: 'Themes',
        action: 'delete',
        referenceId: theme.id,
        changes: { before }
    });

    res.json({ message: 'Theme deleted successfully' });
};
