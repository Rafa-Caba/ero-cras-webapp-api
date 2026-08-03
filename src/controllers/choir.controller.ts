// src/controllers/choir.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import {
    createChoir,
    deactivateChoir,
    getVisibleChoirById,
    listVisibleChoirs,
    updateChoir
} from '../services/choir.service';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import type { ChoirMutationBody } from '../validations/schemas/choir.schemas';
import {
    parseChoirIdParam,
    parseCreateChoirBody,
    parsePositivePage,
    parseUpdateChoirBody
} from '../validations/schemas/choir.schemas';

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
    const choirObjectId = new Types.ObjectId();
    const actorUserId = new Types.ObjectId(currentUser.id);
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId: choirObjectId,
            actorUserId,
            ownerType: 'CHOIR',
            category: 'choir-logo'
        })
        : null;

    const choir = await createChoir(
        choirObjectId,
        input,
        currentUser.id,
        uploaded
            ? {
                url: uploaded.media.url,
                publicId: uploaded.media.publicId,
                resourceType: uploaded.media.resourceType,
                assetId: uploaded.asset._id
            }
            : undefined
    ).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirObjectId,
                'Choir creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirObjectId,
            'CHOIR',
            choir._id
        );
    }

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'create',
        operation: 'choir.create',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        after: choir.toJSON(),
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
    const existingChoir = await getVisibleChoirById(currentUser, choirId);
    const choirObjectId = existingChoir._id;
    const wasActive = existingChoir.isActive;
    const before = existingChoir.toJSON();
    const actorUserId = new Types.ObjectId(currentUser.id);
    const previousAssetId = existingChoir.logoAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId: choirObjectId,
            actorUserId,
            ownerType: 'CHOIR',
            category: 'choir-logo'
        })
        : null;

    const choir = await updateChoir(
        choirId,
        input,
        currentUser.id,
        uploaded
            ? {
                url: uploaded.media.url,
                publicId: uploaded.media.publicId,
                resourceType: uploaded.media.resourceType,
                assetId: uploaded.asset._id
            }
            : undefined
    ).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirObjectId,
                'Choir update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirObjectId,
            'CHOIR',
            choir._id
        );
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId: choirObjectId,
            ownerType: 'CHOIR',
            ownerId: choir._id
        });
    }

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'update',
        operation: wasActive !== choir.isActive
            ? (choir.isActive ? 'choir.activate' : 'choir.deactivate')
            : 'choir.update',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        before,
        after: choir.toJSON(),
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
    const existingChoir = await getVisibleChoirById(currentUser, choirId);
    const before = existingChoir.toJSON();
    const choir = await deactivateChoir(choirId, currentUser.id);

    await registerLog({
        req,
        collection: 'Choirs',
        action: 'delete',
        operation: 'choir.deactivate',
        referenceId: choir._id.toString(),
        choirId: choir._id.toString(),
        before,
        after: choir.toJSON(),
        changes: { deactivated: choir.toJSON() }
    });

    res.json({ message: 'Choir deactivated successfully' });
};
