// src/controllers/log.controller.ts

import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import Log, { type ILog, type LogAction } from '../models/Log';
import User from '../models/User';
import { requireEffectiveChoirObjectId } from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import type { AuditLogResponse, AuditUserSummary } from '../types/audit.types';
import { parseObjectId, parsePagination } from '../validations/schemas/common.schemas';

interface UserLogParams {
    readonly userId: string;
}

const LOG_ACTIONS: readonly LogAction[] = [
    'create',
    'update',
    'delete',
    'add_reaction',
    'remove_reaction'
];

const readQueryValue = (value: RequestWithUser['query'][string]): string | undefined => {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const readAction = (value: string | undefined): LogAction | undefined => {
    if (!value) {
        return undefined;
    }

    const action = LOG_ACTIONS.find((item) => item === value);

    if (!action) {
        throw new AppError(400, 'INVALID_LOG_ACTION', 'Invalid log action');
    }

    return action;
};

const buildFilters = (
    req: RequestWithUser,
    forcedChoirId?: Types.ObjectId
): FilterQuery<ILog> => {
    const filters: FilterQuery<ILog> = {};
    const collection = readQueryValue(req.query.collection);
    const operation = readQueryValue(req.query.operation);
    const action = readAction(readQueryValue(req.query.action));
    const actorUserId = readQueryValue(req.query.actorUserId) ?? readQueryValue(req.query.userId);
    const targetUserId = readQueryValue(req.query.targetUserId);
    const requestedChoirId = readQueryValue(req.query.choirId);

    if (forcedChoirId) {
        filters.choirId = forcedChoirId;
    } else if (requestedChoirId) {
        filters.choirId = parseObjectId(requestedChoirId, 'choirId');
    }

    if (collection) {
        filters.collectionName = collection;
    }

    if (operation) {
        filters.operation = operation;
    }

    if (action) {
        filters.action = action;
    }

    if (actorUserId) {
        const actorObjectId = parseObjectId(actorUserId, 'actorUserId');
        filters.$or = [
            { actorUserId: actorObjectId },
            { user: actorObjectId }
        ];
    }

    if (targetUserId) {
        filters.targetUserId = parseObjectId(targetUserId, 'targetUserId');
    }

    return filters;
};

const loadUserSummaries = async (
    logs: readonly ILog[]
): Promise<Map<string, AuditUserSummary>> => {
    const ids = new Set<string>();

    logs.forEach((log) => {
        ids.add((log.actorUserId ?? log.user).toString());
        if (log.targetUserId) {
            ids.add(log.targetUserId.toString());
        }
    });

    if (ids.size === 0) {
        return new Map<string, AuditUserSummary>();
    }

    const users = await User.find({
        _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) }
    }).select('name username role');
    const summaries = new Map<string, AuditUserSummary>();

    users.forEach((user) => {
        summaries.set(user.id, {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role
        });
    });

    return summaries;
};

const serializeLogs = async (
    logs: readonly ILog[]
): Promise<readonly AuditLogResponse[]> => {
    const users = await loadUserSummaries(logs);

    return logs.map((log) => {
        const actorUserId = (log.actorUserId ?? log.user).toString();
        const actor = users.get(actorUserId) ?? null;
        const targetUser = log.targetUserId
            ? users.get(log.targetUserId.toString()) ?? null
            : null;

        return {
            id: log.id,
            action: log.action,
            operation: log.operation || `${log.collectionName.toLowerCase()}.${log.action}`,
            collectionName: log.collectionName,
            referenceId: log.referenceId.toString(),
            actorUserId,
            actor,
            actorRole: log.actorRole ?? actor?.role ?? null,
            targetChoirId: (log.targetChoirId ?? log.choirId).toString(),
            targetUserId: log.targetUserId?.toString() ?? null,
            targetUser,
            description: log.description ?? '',
            before: log.before ?? null,
            after: log.after ?? null,
            changes: log.changes ?? {},
            ipAddress: log.ipAddress ?? '',
            userAgent: log.userAgent ?? '',
            deviceId: log.deviceId ?? '',
            timestamp: (log.timestamp ?? log.createdAt)?.toISOString() ?? '',
            createdAt: log.createdAt?.toISOString() ?? ''
        };
    });
};

const sendPaginatedLogs = async (
    req: RequestWithUser,
    res: Response,
    filters: FilterQuery<ILog>,
    defaultLimit: number
): Promise<void> => {
    const pageValue = readQueryValue(req.query.page);
    const limitValue = readQueryValue(req.query.limit);
    const pagination = parsePagination(
        { page: pageValue, limit: limitValue },
        defaultLimit,
        100
    );
    const [logs, totalLogs] = await Promise.all([
        Log.find(filters)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        Log.countDocuments(filters)
    ]);

    res.json({
        logs: await serializeLogs(logs),
        currentPage: pagination.page,
        totalPages: Math.max(1, Math.ceil(totalLogs / pagination.limit)),
        totalLogs
    });
};

export const listLogsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    await sendPaginatedLogs(req, res, buildFilters(req, choirId), 20);
};

export const listPlatformLogsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    await sendPaginatedLogs(req, res, buildFilters(req), 20);
};

export const listUserLogsController = async (
    req: RequestWithUser & { params: UserLogParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const userId = parseObjectId(req.params.userId, 'userId');
    const userExists = await User.exists({ _id: userId, choirId });

    if (!userExists) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    await sendPaginatedLogs(
        req,
        res,
        { choirId, $or: [{ user: userId }, { targetUserId: userId }] },
        10
    );
};
