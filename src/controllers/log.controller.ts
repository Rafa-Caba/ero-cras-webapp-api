// src/controllers/log.controller.ts

import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { AppError } from '../errors/AppError';
import Log, { type ILog, type LogAction } from '../models/Log';
import User from '../models/User';
import { requireEffectiveChoirObjectId } from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
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

export const listLogsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const pageValue = readQueryValue(req.query.page);
    const limitValue = readQueryValue(req.query.limit);
    const collection = readQueryValue(req.query.collection);
    const action = readAction(readQueryValue(req.query.action));
    const userId = readQueryValue(req.query.userId);
    const pagination = parsePagination(
        { page: pageValue, limit: limitValue },
        10,
        100
    );
    const filters: FilterQuery<ILog> = { choirId };

    if (collection) {
        filters.collectionName = collection;
    }

    if (action) {
        filters.action = action;
    }

    if (userId) {
        filters.user = parseObjectId(userId, 'userId');
    }

    const [logs, totalLogs] = await Promise.all([
        Log.find(filters)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .populate('user', 'name username role'),
        Log.countDocuments(filters)
    ]);

    res.json({
        logs,
        currentPage: pagination.page,
        totalPages: Math.ceil(totalLogs / pagination.limit),
        totalLogs
    });
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

    const pageValue = readQueryValue(req.query.page);
    const limitValue = readQueryValue(req.query.limit);
    const pagination = parsePagination(
        { page: pageValue, limit: limitValue },
        6,
        100
    );
    const filters: FilterQuery<ILog> = { choirId, user: userId };
    const [logs, totalLogs] = await Promise.all([
        Log.find(filters)
            .populate('user', 'name username role')
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit),
        Log.countDocuments(filters)
    ]);

    res.json({
        logs,
        currentPage: pagination.page,
        totalPages: Math.ceil(totalLogs / pagination.limit),
        totalLogs
    });
};
