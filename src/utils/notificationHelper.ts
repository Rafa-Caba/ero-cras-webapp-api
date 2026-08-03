// src/utils/notificationHelper.ts

import { Types } from 'mongoose';
import type { StoredJsonValue } from '../types/content.types';
import {
    findActiveChoirDevices,
    sendPushToDevices
} from '../services/expoPush.service';

interface CommunityNotificationItem {
    readonly id?: string;
    readonly title?: string;
    readonly type?: string;
    readonly content?: StoredJsonValue;
}

type CommunityNotificationCategory = 'CHAT' | 'ANNOUNCEMENT' | 'BLOG';

const getChatBody = (item: CommunityNotificationItem): string => {
    if (item.type === 'TEXT' && typeof item.content === 'string') {
        return item.content.trim() || 'Mensaje recibido';
    }

    if (item.type) {
        return `Se envió un ${item.type.toLowerCase()}`;
    }

    return 'Mensaje recibido';
};

const deliverCommunityNotification = async (
    choirId: string,
    senderId: string | undefined,
    senderName: string,
    category: CommunityNotificationCategory,
    item: CommunityNotificationItem
): Promise<void> => {
    const choirObjectId = new Types.ObjectId(choirId);
    const excludedUserId = senderId && Types.ObjectId.isValid(senderId)
        ? new Types.ObjectId(senderId)
        : undefined;
    const devices = await findActiveChoirDevices(
        choirObjectId,
        excludedUserId
    );

    if (devices.length === 0) {
        return;
    }

    const itemId = item.id ?? '';

    if (category === 'CHAT') {
        await sendPushToDevices(devices, {
            title: `Nuevo mensaje de ${senderName}`,
            body: getChatBody(item),
            data: { type: 'CHAT', messageId: itemId }
        });
        return;
    }

    if (category === 'ANNOUNCEMENT') {
        await sendPushToDevices(devices, {
            title: '📢 Nuevo aviso',
            body: item.title ?? 'Revísalo en la app',
            data: { type: 'ANNOUNCEMENT', id: itemId }
        });
        return;
    }

    await sendPushToDevices(devices, {
        title: '📝 Nuevo blog',
        body: item.title ?? 'Lee la nueva publicación',
        data: { type: 'BLOG', id: itemId }
    });
};

export const notifyCommunity = async (
    choirId: string,
    senderId: string | undefined,
    senderName: string,
    category: CommunityNotificationCategory,
    item: CommunityNotificationItem
): Promise<void> => {
    await deliverCommunityNotification(
        choirId,
        senderId,
        senderName,
        category,
        item
    ).catch((error: Error) => {
        console.error('Push notification delivery failed:', error.message);
    });
};
