// src/controllers/instrument.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import Instrument, { type IInstrument } from '../models/Instrument';
import Member from '../models/Member';
import User from '../models/User';
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
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { parseObjectId } from '../validations/schemas/common.schemas';
import { parseInstrumentInput } from '../validations/schemas/resource.schemas';

interface ResourceParams {
    readonly id: string;
}

const findInstrument = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IInstrument> => {
    return Instrument
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'INSTRUMENT_NOT_FOUND',
            'Instrument not found'
        ))
        .exec();
};

export const listInstrumentsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const instruments = await Instrument.find({
        choirId: requireEffectiveChoirObjectId(req)
    }).sort({ order: 1, name: 1 });
    res.json(instruments);
};

export const getInstrumentController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    res.json(await findInstrument(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    ));
};

export const createInstrumentController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseInstrumentInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const instrumentId = new Types.ObjectId();
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'INSTRUMENT',
            category: 'instruments'
        })
        : null;

    const instrument = await Instrument.create({
        _id: instrumentId,
        ...input,
        iconUrl: uploaded?.media.url ?? '',
        iconPublicId: uploaded?.media.publicId ?? null,
        iconResourceType: uploaded?.media.resourceType ?? null,
        iconAssetId: uploaded?.asset._id ?? null,
        choirId,
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Instrument creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'INSTRUMENT',
            instrument._id
        );
    }

    await registerLog({
        req,
        collection: 'Instruments',
        action: 'create',
        referenceId: instrument.id,
        changes: { after: instrument.toObject() }
    });

    res.status(201).json(instrument);
};

export const updateInstrumentController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const instrument = await findInstrument(req.params.id, choirId);
    const before = instrument.toObject();
    const input = parseInstrumentInput(req);
    const previousAssetId = instrument.iconAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'INSTRUMENT',
            category: 'instruments'
        })
        : null;

    instrument.name = input.name;
    instrument.slug = input.slug;
    instrument.category = input.category;
    instrument.iconKey = input.iconKey;
    instrument.isActive = input.isActive;
    instrument.order = input.order;
    instrument.updatedBy = actorUserId;

    if (uploaded) {
        instrument.iconUrl = uploaded.media.url;
        instrument.iconPublicId = uploaded.media.publicId;
        instrument.iconResourceType = uploaded.media.resourceType;
        instrument.iconAssetId = uploaded.asset._id;
    }

    await instrument.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Instrument update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(
            uploaded.asset._id,
            choirId,
            'INSTRUMENT',
            instrument._id
        );
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'INSTRUMENT',
            ownerId: instrument._id
        });
    }

    await registerLog({
        req,
        collection: 'Instruments',
        action: 'update',
        referenceId: instrument.id,
        changes: { before, after: instrument.toObject() }
    });

    res.json(instrument);
};

export const deleteInstrumentController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const instrument = await findInstrument(req.params.id, choirId);
    const [userReference, memberReference] = await Promise.all([
        User.exists({ choirId, instrumentId: instrument._id }),
        Member.exists({ choirId, instrumentId: instrument._id })
    ]);

    if (userReference || memberReference) {
        throw new AppError(
            409,
            'INSTRUMENT_IN_USE',
            'The instrument cannot be deleted while it is assigned'
        );
    }

    const before = instrument.toObject();
    const assetId = instrument.iconAssetId;
    await instrument.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'INSTRUMENT',
        ownerId: instrument._id
    });

    await registerLog({
        req,
        collection: 'Instruments',
        action: 'delete',
        referenceId: instrument.id,
        changes: { before }
    });

    res.json({ message: 'Instrument deleted successfully' });
};
