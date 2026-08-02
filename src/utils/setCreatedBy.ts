// src/utils/setCreatedBy.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../middlewares/auth';

type AuditBodyValue = string | number | boolean | object | null | undefined;

type MutableAuditBody = Record<string, AuditBodyValue>;

type AuditFieldName = 'createdBy' | 'updatedBy';

const isMutableAuditBody = (
    value: AuditBodyValue
): value is MutableAuditBody => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const ensureMutableBody = (req: RequestWithUser): MutableAuditBody => {
    const requestBody: AuditBodyValue = req.body;
    const body = isMutableAuditBody(requestBody) ? requestBody : {};

    req.body = body;
    return body;
};

const applyAuthoritativeFields = (
    body: MutableAuditBody,
    fieldName: AuditFieldName,
    userId: string | undefined,
    effectiveChoirId: string | null | undefined
): void => {
    if (userId) {
        body[fieldName] = userId;
    } else {
        delete body[fieldName];
    }

    if (effectiveChoirId) {
        body.choirId = effectiveChoirId;
    } else {
        delete body.choirId;
    }
};

const applyNestedMobilePayload = (
    body: MutableAuditBody,
    fieldName: AuditFieldName,
    userId: string | undefined,
    effectiveChoirId: string | null | undefined
): void => {
    if (typeof body.data !== 'string') {
        return;
    }

    let parsedBody: AuditBodyValue;

    try {
        parsedBody = JSON.parse(body.data);
    } catch {
        throw new AppError(
            400,
            'INVALID_MULTIPART_DATA',
            'The multipart data field must contain a valid JSON object'
        );
    }

    if (!isMutableAuditBody(parsedBody)) {
        throw new AppError(
            400,
            'INVALID_MULTIPART_DATA',
            'The multipart data field must contain a JSON object'
        );
    }

    applyAuthoritativeFields(
        parsedBody,
        fieldName,
        userId,
        effectiveChoirId
    );
    body.data = JSON.stringify(parsedBody);
};

const applyAuditContext = (
    req: RequestWithUser,
    fieldName: AuditFieldName
): void => {
    const body = ensureMutableBody(req);
    const userId = req.user?.id;
    const effectiveChoirId = req.auth?.effectiveChoirId;

    applyAuthoritativeFields(body, fieldName, userId, effectiveChoirId);
    applyNestedMobilePayload(
        body,
        fieldName,
        userId,
        effectiveChoirId
    );
};

export const setCreatedBy = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    applyAuditContext(req, 'createdBy');
    next();
};

export const setUpdatedBy = (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
): void => {
    applyAuditContext(req, 'updatedBy');
    next();
};
