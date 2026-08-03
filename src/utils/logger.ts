// src/utils/logger.ts

import { Types } from 'mongoose';
import Log, { type LogAction } from '../models/Log';
import type { RequestWithUser } from '../types/auth.types';
import type { StoredJsonObject } from '../types/content.types';

interface RegisterLogPayload {
    readonly req: RequestWithUser;
    readonly collection: string;
    readonly action: LogAction;
    readonly referenceId: string;
    readonly operation?: string;
    readonly description?: string;
    readonly targetUserId?: string;
    readonly before?: StoredJsonObject | null;
    readonly after?: StoredJsonObject | null;
    readonly changes?: StoredJsonObject;
    readonly choirId?: string;
}

const readHeader = (value: string | readonly string[] | undefined): string => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.join(', ').trim();
    }

    return '';
};

const normalizeOperationPart = (value: string): string => {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

export const registerLog = async ({
    req,
    collection,
    action,
    referenceId,
    operation,
    description = '',
    targetUserId,
    before = null,
    after = null,
    changes = {},
    choirId
}: RegisterLogPayload): Promise<void> => {
    const currentUser = req.user;

    if (!currentUser) {
        return;
    }

    const effectiveChoirId = choirId ?? req.auth?.effectiveChoirId ?? currentUser.choirId;

    if (!effectiveChoirId || !Types.ObjectId.isValid(effectiveChoirId)) {
        console.error(`Audit log rejected for ${collection}/${action}: missing valid target choir`);
        return;
    }

    if (!Types.ObjectId.isValid(referenceId)) {
        console.error(`Audit log rejected for ${collection}/${action}: invalid referenceId`);
        return;
    }

    const normalizedOperation = operation ?? `${normalizeOperationPart(collection)}.${action}`;

    try {
        await Log.create({
            user: new Types.ObjectId(currentUser.id),
            actorUserId: new Types.ObjectId(currentUser.id),
            actorRole: currentUser.role,
            choirId: new Types.ObjectId(effectiveChoirId),
            targetChoirId: new Types.ObjectId(effectiveChoirId),
            targetUserId: targetUserId && Types.ObjectId.isValid(targetUserId)
                ? new Types.ObjectId(targetUserId)
                : null,
            collectionName: collection,
            action,
            operation: normalizedOperation,
            referenceId: new Types.ObjectId(referenceId),
            description,
            before,
            after,
            changes,
            ipAddress: req.ip ?? '',
            userAgent: readHeader(req.headers['user-agent']),
            deviceId: readHeader(req.headers['x-device-id']),
            timestamp: new Date()
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Audit log write failed';
        console.error(`Audit log write failed: ${message}`);
    }
};
