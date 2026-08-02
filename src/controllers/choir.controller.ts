// src/controllers/choir.controller.ts

import type { Response } from 'express';
import { AppError } from '../errors/AppError';
import { registerLog } from '../utils/logger';
import type { RequestWithUser } from '../types/auth.types';
import type { ChoirMutationBody } from '../validations/schemas/choir.schemas';
import {
    parseChoirIdParam,
    parseCreateChoirBody,
    parsePositivePage,
    parseUpdateChoirBody
} from '../validations/schemas/choir.schemas';
import {
    createChoir,
    deactivateChoir,
    getVisibleChoirById,
    listPublicChoirs,
    listVisibleChoirs,
    updateChoir
} from '../services/choir.service';

const requireAuthenticatedUser = (req: RequestWithUser) => {
    if (!req.user) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated user has not been loaded'
        );
    }

    return req.user;
};

const readUploadedLogo = (
    file?: Express.Multer.File
): { readonly url: string; readonly publicId: string } | undefined => {
    if (!file) {
        return undefined;
    }

    if (!file.path || !file.filename) {
        throw new AppError(
            500,
            'UPLOAD_RESULT_INVALID',
            'The uploaded logo did not return the required metadata'
        );
    }

    return {
        url: file.path,
        publicId: file.filename
    };
};

export const listPublicChoirsController = async (
    _req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirs = await listPublicChoirs();
    res.json(choirs.map((choir) => choir.toJSON()));
};

export const listChoirsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const currentUser = requireAuthenticatedUser(req);
    const queryPage = typeof req.query.page === 'string'
        ? req.query.page
        : undefined;
    const page = parsePositivePage(queryPage);
    const result = await listVisibleChoirs(currentUser, page);

    res.json({
        choirs: result.choirs.map((choir) => choir.toJSON()),
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalChoirs: result.totalChoirs
    });
};

export const getChoirController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const currentUser = requireAuthenticatedUser(req);
    const choirId = parseChoirIdParam(req.params.id);
    const choir = await getVisibleChoirById(currentUser, choirId);
    res.json(choir.toJSON());
};

export const createChoirController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const currentUser = requireAuthenticatedUser(req);
    const body: ChoirMutationBody | undefined = req.body;
    const input = parseCreateChoirBody(body);
    const choir = await createChoir(
        input,
        currentUser.id,
        readUploadedLogo(req.file)
    );

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'create',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        changes: { new: choir.toJSON() }
    });

    res.status(201).json(choir.toJSON());
};

export const updateChoirController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const currentUser = requireAuthenticatedUser(req);
    const body: ChoirMutationBody | undefined = req.body;
    const input = parseUpdateChoirBody(body);
    const choirId = parseChoirIdParam(req.params.id);
    const choir = await updateChoir(
        choirId,
        input,
        currentUser.id,
        readUploadedLogo(req.file)
    );

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'update',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        changes: { updated: choir.toJSON() }
    });

    res.json(choir.toJSON());
};

export const deactivateChoirController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const currentUser = requireAuthenticatedUser(req);
    const choirId = parseChoirIdParam(req.params.id);
    const choir = await deactivateChoir(choirId, currentUser.id);

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'delete',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        changes: { deactivated: choir.toJSON() }
    });

    res.json({ message: 'Choir deactivated successfully' });
};
