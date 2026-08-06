// src/controllers/notification.controller.ts

import type { Response } from 'express';
import Notification from '../models/Notification';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import type { ChoirSocketServer } from '../types/socket.types';
import {
    NOTIFICATION_CATEGORIES,
    type NotificationCategory
} from '../types/notification.types';
import { AppError } from '../errors/AppError';
import {
    parseObjectId,
    parseRequestBody,
    readOptionalString
} from '../validations/schemas/common.schemas';

const getSocketServer = (req: RequestWithUser): ChoirSocketServer | undefined => {
    const io: ChoirSocketServer | undefined = req.app.get('io');
    return io;
};

const emitNotificationsRead = (req: RequestWithUser, userId: string): void => {
    getSocketServer(req)?.to(`user:${userId}`).emit('notifications-read');
};

interface NotificationParams {
    readonly notificationId: string;
}

interface NotificationSummary {
    readonly total: number;
    readonly chat: number;
    readonly blog: number;
}

const parseCategory = (value: string | undefined): NotificationCategory | undefined => {
    if (!value) {
        return undefined;
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'CHAT' || normalized === 'BLOG') {
        return normalized;
    }

    throw new AppError(
        400,
        'INVALID_NOTIFICATION_CATEGORY',
        `category must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`
    );
};

const buildSummary = async (
    recipientUserId: ReturnType<typeof parseObjectId>,
    choirId: ReturnType<typeof parseObjectId>
): Promise<NotificationSummary> => {
    const [total, chat, blog] = await Promise.all([
        Notification.countDocuments({ recipientUserId, choirId, isRead: false }),
        Notification.countDocuments({
            recipientUserId,
            choirId,
            category: 'CHAT',
            isRead: false
        }),
        Notification.countDocuments({
            recipientUserId,
            choirId,
            category: 'BLOG',
            isRead: false
        })
    ]);

    return { total, chat, blog };
};

export const listNotificationsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const recipientUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const limitValue = typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : 100;
    const limit = Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 200)
        : 100;

    const [notifications, summary] = await Promise.all([
        Notification.find({ recipientUserId, choirId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('actorUserId', 'name username imageUrl'),
        buildSummary(recipientUserId, choirId)
    ]);

    res.json({ notifications, summary });
};

export const markNotificationReadController = async (
    req: RequestWithUser & { params: NotificationParams },
    res: Response
): Promise<void> => {
    const recipientUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const notification = await Notification.findOneAndUpdate(
        {
            _id: parseObjectId(req.params.notificationId, 'notificationId'),
            recipientUserId,
            choirId
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    ).populate('actorUserId', 'name username imageUrl');

    if (!notification) {
        throw new AppError(
            404,
            'NOTIFICATION_NOT_FOUND',
            'Notification not found'
        );
    }

    emitNotificationsRead(req, recipientUserId.toString());
    res.json({ notification });
};

export const markNotificationsReadController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const recipientUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const body = parseRequestBody(req);
    const category = parseCategory(readOptionalString(body, 'category'));
    const filter = {
        recipientUserId,
        choirId,
        isRead: false,
        ...(category ? { category } : {})
    };

    await Notification.updateMany(filter, {
        $set: {
            isRead: true,
            readAt: new Date()
        }
    });

    emitNotificationsRead(req, recipientUserId.toString());
    res.json({ summary: await buildSummary(recipientUserId, choirId) });
};
