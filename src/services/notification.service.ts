// src/services/notification.service.ts

import { Types } from 'mongoose';
import Notification, { type INotification } from '../models/Notification';
import User from '../models/User';
import type { ChoirSocketServer } from '../types/socket.types';
import type {
    NotificationCategory,
    NotificationType
} from '../types/notification.types';

interface CreateNotificationInput {
    readonly choirId: Types.ObjectId;
    readonly actorUserId: Types.ObjectId;
    readonly recipientUserIds: readonly Types.ObjectId[];
    readonly category: NotificationCategory;
    readonly type: NotificationType;
    readonly title: string;
    readonly body: string;
    readonly resourceId: Types.ObjectId;
    readonly resourceSubId?: Types.ObjectId | null;
    readonly dedupeKey: string;
    readonly io?: ChoirSocketServer;
}

interface CreateChoirNotificationInput extends Omit<CreateNotificationInput, 'recipientUserIds'> {
    readonly excludedUserIds?: readonly Types.ObjectId[];
}

interface RemoveNotificationInput {
    readonly recipientUserId: Types.ObjectId;
    readonly dedupeKey: string;
    readonly io?: ChoirSocketServer;
}

interface RemoveResourceNotificationsInput {
    readonly choirId: Types.ObjectId;
    readonly category: NotificationCategory;
    readonly resourceId: Types.ObjectId;
    readonly io?: ChoirSocketServer;
}

const populateActor = async (
    notification: INotification
): Promise<INotification> => {
    await notification.populate('actorUserId', 'name username imageUrl');
    return notification;
};

const emitCreated = (
    io: ChoirSocketServer | undefined,
    notification: INotification
): void => {
    io?.to(`user:${notification.recipientUserId.toString()}`).emit(
        'notification-created',
        notification.toJSON()
    );
};

export const findActiveChoirRecipientIds = async (
    choirId: Types.ObjectId,
    excludedUserIds: readonly Types.ObjectId[] = []
): Promise<readonly Types.ObjectId[]> => {
    const excludedIds = excludedUserIds.map((id) => id.toString());
    const users = await User.find({
        choirId,
        isActive: true,
        ...(excludedIds.length > 0
            ? { _id: { $nin: excludedUserIds } }
            : {})
    })
        .select('_id')
        .lean();

    return users.map((user) => user._id);
};

export const createNotifications = async (
    input: CreateNotificationInput
): Promise<readonly INotification[]> => {
    const uniqueRecipientIds = [...new Map(
        input.recipientUserIds.map((recipientUserId) => [
            recipientUserId.toString(),
            recipientUserId
        ])
    ).values()].filter((recipientUserId) => !recipientUserId.equals(input.actorUserId));

    const notifications = await Promise.all(
        uniqueRecipientIds.map(async (recipientUserId) => {
            const notification = await Notification.findOneAndUpdate(
                {
                    recipientUserId,
                    dedupeKey: input.dedupeKey
                },
                {
                    $set: {
                        actorUserId: input.actorUserId,
                        title: input.title,
                        body: input.body,
                        resourceSubId: input.resourceSubId ?? null,
                        isRead: false,
                        readAt: null
                    },
                    $setOnInsert: {
                        choirId: input.choirId,
                        recipientUserId,
                        category: input.category,
                        type: input.type,
                        resourceId: input.resourceId,
                        dedupeKey: input.dedupeKey
                    }
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            ).orFail().exec();

            await populateActor(notification);
            emitCreated(input.io, notification);
            return notification;
        })
    );

    return notifications;
};

export const createChoirNotifications = async (
    input: CreateChoirNotificationInput
): Promise<readonly INotification[]> => {
    const recipientUserIds = await findActiveChoirRecipientIds(
        input.choirId,
        input.excludedUserIds ?? [input.actorUserId]
    );

    return createNotifications({
        ...input,
        recipientUserIds
    });
};

export const removeNotification = async (
    input: RemoveNotificationInput
): Promise<void> => {
    const notification = await Notification.findOneAndDelete({
        recipientUserId: input.recipientUserId,
        dedupeKey: input.dedupeKey
    });

    if (!notification) {
        return;
    }

    input.io?.to(`user:${input.recipientUserId.toString()}`).emit(
        'notification-removed',
        {
            id: notification.id,
            dedupeKey: input.dedupeKey
        }
    );
};

export const removeResourceNotifications = async (
    input: RemoveResourceNotificationsInput
): Promise<void> => {
    const notifications = await Notification.find({
        choirId: input.choirId,
        category: input.category,
        resourceId: input.resourceId
    }).select('_id recipientUserId dedupeKey');

    if (notifications.length === 0) {
        return;
    }

    await Notification.deleteMany({
        _id: { $in: notifications.map((notification) => notification._id) }
    });

    notifications.forEach((notification) => {
        input.io?.to(`user:${notification.recipientUserId.toString()}`).emit(
            'notification-removed',
            {
                id: notification.id,
                dedupeKey: notification.dedupeKey
            }
        );
    });
};

export const markNotificationResourcesRead = async (
    recipientUserId: Types.ObjectId,
    choirId: Types.ObjectId,
    category: NotificationCategory,
    resourceIds: readonly Types.ObjectId[],
    io?: ChoirSocketServer
): Promise<void> => {
    if (resourceIds.length === 0) {
        return;
    }

    const result = await Notification.updateMany(
        {
            recipientUserId,
            choirId,
            category,
            resourceId: { $in: resourceIds },
            isRead: false
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        }
    );

    if (result.modifiedCount > 0) {
        io?.to(`user:${recipientUserId.toString()}`).emit('notifications-read');
    }
};
