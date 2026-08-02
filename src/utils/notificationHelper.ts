// src/utils/notificationHelper.ts

import { Types, type FilterQuery } from 'mongoose';
import User, { type IUser } from '../models/User';
import type { StoredJsonValue } from '../types/content.types';
import { sendPushNotification } from './pushNotifications';

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

export const notifyCommunity = async (
    choirId: string,
    senderId: string | undefined,
    senderName: string,
    category: CommunityNotificationCategory,
    item: CommunityNotificationItem
): Promise<void> => {
    const filter: FilterQuery<IUser> = {
        choirId: new Types.ObjectId(choirId),
        isActive: true,
        pushToken: { $exists: true, $ne: null }
    };

    if (senderId && Types.ObjectId.isValid(senderId)) {
        filter._id = { $ne: new Types.ObjectId(senderId) };
    }

    const users = await User.find(filter).select('pushToken');
    const tokens = users
        .map((user) => user.pushToken)
        .filter((token): token is string =>
            typeof token === 'string' && token.length > 0
        );

    if (tokens.length === 0) {
        return;
    }

    const itemId = item.id ?? '';
    let title: string;
    let body: string;
    let data: Record<string, string>;

    switch (category) {
        case 'CHAT':
            title = `Nuevo mensaje de ${senderName}`;
            body = getChatBody(item);
            data = { type: 'CHAT', messageId: itemId };
            break;
        case 'ANNOUNCEMENT':
            title = '📢 Nuevo aviso';
            body = item.title ?? 'Revísalo en la app';
            data = { type: 'ANNOUNCEMENT', id: itemId };
            break;
        case 'BLOG':
            title = '📝 Nuevo blog';
            body = item.title ?? 'Lee la nueva publicación';
            data = { type: 'BLOG', id: itemId };
            break;
    }

    await sendPushNotification(tokens, title, body, data);
};
