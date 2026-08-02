// src/services/publicChoir.service.ts

import type { Request } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import Choir from '../models/Choir';
import { readQueryString } from '../validations/schemas/common.schemas';

interface PublicChoirParams {
    readonly choirKey?: string;
}

export const resolvePublicChoirId = async (
    req: Request<PublicChoirParams>
): Promise<Types.ObjectId> => {
    const selector =
        readQueryString(req.query.choirCode) ??
        readQueryString(req.query.choirKey) ??
        readQueryString(req.query.choirId) ??
        req.params.choirKey?.trim();

    if (!selector) {
        throw new AppError(
            400,
            'PUBLIC_CHOIR_REQUIRED',
            'A choirCode or choirKey is required'
        );
    }

    const selectorFilter = Types.ObjectId.isValid(selector)
        ? { _id: new Types.ObjectId(selector) }
        : { code: selector.toLowerCase() };

    const choir = await Choir.findOne({
        ...selectorFilter,
        isActive: true
    }).select('_id');

    if (!choir) {
        throw new AppError(
            404,
            'PUBLIC_CHOIR_NOT_FOUND',
            'The requested choir does not exist or is inactive'
        );
    }

    return choir._id;
};
