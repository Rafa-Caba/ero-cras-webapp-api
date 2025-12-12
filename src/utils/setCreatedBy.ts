import { NextFunction, Response } from 'express';
import { RequestWithUser } from '../middlewares/auth';

type MutableRequest = RequestWithUser & { body: any };

const ensureBodyObject = (req: MutableRequest) => {
    if (!req.body || typeof req.body !== 'object') {
        req.body = {};
    }
};

export const setCreatedBy = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    const r = req as MutableRequest;
    ensureBodyObject(r);

    if (r.user?.id) {
        r.body.createdBy = r.user.id;

        if (r.user.choirId && !r.body.choirId) {
            r.body.choirId = r.user.choirId;
        }
    }

    next();
};

export const setUpdatedBy = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    const r = req as MutableRequest;
    ensureBodyObject(r);

    if (r.user?.id) {
        r.body.updatedBy = r.user.id;

        // Multi-choir: keep behavior consistent with setCreatedBy
        if (r.user.choirId && !r.body.choirId) {
            r.body.choirId = r.user.choirId;
        }
    }

    next();
};
