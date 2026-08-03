// src/services/httpCache.service.ts

import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import type { UpdatedSinceFilter } from '../types/sync.types';

const buildEntityTag = (serializedPayload: string): string => {
    const digest = createHash('sha256')
        .update(serializedPayload)
        .digest('base64url');

    return `"${digest}"`;
};

const requestAcceptsEntityTag = (
    req: Request,
    entityTag: string
): boolean => {
    const header = req.headers['if-none-match'];

    if (typeof header !== 'string') {
        return false;
    }

    return header
        .split(',')
        .map((value) => value.trim())
        .includes(entityTag);
};

const setPrivateCacheHeaders = (
    res: Response,
    entityTag?: string,
    syncTimestamp: Date = new Date()
): void => {
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Vary', 'Authorization, x-target-choir-id');
    res.setHeader('X-Sync-Timestamp', syncTimestamp.toISOString());

    if (entityTag) {
        res.setHeader('ETag', entityTag);
    }
};

export const buildUpdatedSinceFilter = (
    updatedSince: Date | null
): UpdatedSinceFilter => {
    if (!updatedSince) {
        return {};
    }

    return {
        updatedAt: {
            $gt: updatedSince
        }
    };
};

export const sendCacheableJson = (
    req: Request,
    res: Response,
    payload: object,
    syncTimestamp: Date = new Date()
): void => {
    const serializedPayload = JSON.stringify(payload);
    const entityTag = buildEntityTag(serializedPayload);

    setPrivateCacheHeaders(res, entityTag, syncTimestamp);

    if (requestAcceptsEntityTag(req, entityTag)) {
        res.status(304).end();
        return;
    }

    res.type('application/json').send(serializedPayload);
};
