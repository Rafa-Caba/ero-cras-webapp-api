// src/controllers/instrument.controller.ts

import type { Response } from 'express';
import { AppError } from '../errors/AppError';
import { deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import Instrument, { type IInstrument } from '../models/Instrument';
import Member from '../models/Member';
import User from '../models/User';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import { parseInstrumentInput } from '../validations/schemas/resource.schemas';
import { parseObjectId } from '../validations/schemas/common.schemas';

interface ResourceParams {
    readonly id: string;
}

const findInstrument = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IInstrument> => {
    return Instrument
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'INSTRUMENT_NOT_FOUND',
                'Instrument not found'
            )
        )
        .exec();
};

export const listInstrumentsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const instruments = await Instrument.find({
        choirId: requireEffectiveChoirObjectId(req)
    }).sort({ order: 1, name: 1 });
    res.json({ instruments });
};

export const getInstrumentController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const instrument = await findInstrument(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    res.json(instrument);
};

export const createInstrumentController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const instrument = await Instrument.create({
        ...parseInstrumentInput(req),
        iconUrl: req.file?.path ?? '',
        iconPublicId: req.file?.filename ?? null,
        choirId: requireEffectiveChoirObjectId(req),
        createdBy: requireAuthenticatedUserId(req)
    });

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
    const instrument = await findInstrument(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = instrument.toObject();
    const input = parseInstrumentInput(req);

    if (req.file) {
        await deleteFromCloudinary(instrument.iconPublicId ?? '');
        instrument.iconUrl = req.file.path;
        instrument.iconPublicId = req.file.filename;
    }

    instrument.name = input.name;
    instrument.slug = input.slug;
    instrument.category = input.category;
    instrument.iconKey = input.iconKey;
    instrument.isActive = input.isActive;
    instrument.order = input.order;
    instrument.updatedBy = requireAuthenticatedUserId(req);
    await instrument.save();

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
    const references = await Promise.all([
        User.exists({ choirId, instrumentId: instrument._id }),
        Member.exists({ choirId, instrumentId: instrument._id })
    ]);

    if (references.some(Boolean)) {
        throw new AppError(
            409,
            'INSTRUMENT_IN_USE',
            'The instrument cannot be deleted while it is assigned'
        );
    }

    const before = instrument.toObject();
    await deleteFromCloudinary(instrument.iconPublicId ?? '');
    await instrument.deleteOne();

    await registerLog({
        req,
        collection: 'Instruments',
        action: 'delete',
        referenceId: instrument.id,
        changes: { before }
    });

    res.json({ message: 'Instrument deleted successfully' });
};
