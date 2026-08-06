// src/controllers/chat.controller.ts

import type { Response } from 'express';
import type { FilterQuery, PopulateOptions } from 'mongoose';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import ChatMessage, {
    type ChatReceiptEntry,
    type IChatMessage,
    type MessageType
} from '../models/ChatMessage';
import User from '../models/User';
import { buildUpdatedSinceFilter, sendCacheableJson } from '../services/httpCache.service';
import {
    attachMediaAsset,
    discardPendingMedia,
    getPendingMediaAsset,
    uploadTenantMedia
} from '../services/media.service';
import {
    createNotifications,
    findActiveChoirRecipientIds,
    markNotificationResourcesRead,
    removeNotification
} from '../services/notification.service';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import type { ChoirSocketServer } from '../types/socket.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import {
    parseObjectId,
    parseRequestBody,
    readRequiredString,
    readRequiredStringArray
} from '../validations/schemas/common.schemas';
import { parseChatMessageInput } from '../validations/schemas/resource.schemas';
import { parseSyncQuery } from '../validations/schemas/sync.schemas';

interface PopulatedAuthorReference {
    readonly _id: Types.ObjectId;
}

interface ChatMessageParams {
    readonly messageId: string;
}

interface ChatUploadResponse {
    readonly assetId: string;
    readonly fileUrl: string;
    readonly filename: string;
    readonly resourceType: string;
}

type ReactionLogAction = 'add_reaction' | 'remove_reaction';
type ChatReceiptStatus = 'DELIVERED' | 'READ';
type MessageRecipientStatus = 'READ' | 'DELIVERED' | 'PENDING';

interface ChatReceiptInput {
    readonly messageIds: readonly string[];
    readonly status: ChatReceiptStatus;
}

interface MessageRecipientDetail {
    readonly user: {
        readonly id: string;
        readonly name: string;
        readonly username: string;
        readonly imageUrl: string;
    };
    readonly status: MessageRecipientStatus;
    readonly deliveredAt: string | null;
    readonly readAt: string | null;
}

const getSocketServer = (req: RequestWithUser): ChoirSocketServer | undefined => {
    const io: ChoirSocketServer | undefined = req.app.get('io');
    return io;
};

const parseChatReceiptInput = (req: RequestWithUser): ChatReceiptInput => {
    const body = parseRequestBody(req);
    const statusValue = readRequiredString(body, 'status').toUpperCase();

    if (statusValue !== 'DELIVERED' && statusValue !== 'READ') {
        throw new AppError(
            400,
            'INVALID_CHAT_RECEIPT_STATUS',
            'status must be DELIVERED or READ'
        );
    }

    return {
        messageIds: readRequiredStringArray(body, 'messageIds', 100),
        status: statusValue
    };
};

const chatMediaPopulate: PopulateOptions = {
    path: 'mediaAssetId',
    select: 'url originalName mimeType bytes format resourceType'
};

const replyPopulate: PopulateOptions = {
    path: 'replyTo',
    populate: [
        { path: 'author', select: 'name username imageUrl' },
        chatMediaPopulate
    ]
};

const populateMessage = async (message: IChatMessage): Promise<IChatMessage> => {
    await message.populate([
        { path: 'author', select: 'name username imageUrl' },
        { path: 'reactions.user', select: 'username name imageUrl' },
        replyPopulate,
        chatMediaPopulate
    ]);
    return message;
};

const emitMessage = (
    req: RequestWithUser,
    eventName: 'new-message' | 'message-updated',
    message: IChatMessage
): void => {
    const io = getSocketServer(req);

    if (io) {
        io.to(`choir:${requireEffectiveChoirId(req)}`).emit(
            eventName,
            message.toJSON()
        );
    }
};

const requireUpload = (req: RequestWithUser): Express.Multer.File => {
    if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'A file is required');
    }

    return req.file;
};

const assertChatMediaMatchesType = (
    messageType: MessageType,
    mimeType: string
): void => {
    const valid =
        (messageType === 'IMAGE' && mimeType.startsWith('image/')) ||
        (messageType === 'AUDIO' && mimeType.startsWith('audio/')) ||
        (messageType === 'VIDEO' && mimeType.startsWith('video/')) ||
        (messageType === 'MEDIA' && (
            mimeType.startsWith('audio/') || mimeType.startsWith('video/')
        )) ||
        (messageType === 'FILE' && (
            !mimeType.startsWith('image/') &&
            !mimeType.startsWith('audio/') &&
            !mimeType.startsWith('video/')
        ));

    if (!valid) {
        throw new AppError(
            400,
            'CHAT_MEDIA_TYPE_MISMATCH',
            'The uploaded media does not match the chat message type'
        );
    }
};

const uploadChatAsset = async (
    req: RequestWithUser
): Promise<ChatUploadResponse> => {
    const result = await uploadTenantMedia({
        file: requireUpload(req),
        choirId: requireEffectiveChoirObjectId(req),
        actorUserId: requireAuthenticatedUserId(req),
        ownerType: 'CHAT',
        category: 'chat'
    });

    return {
        assetId: result.media.assetId,
        fileUrl: result.media.url,
        filename: result.asset.originalName,
        resourceType: result.media.resourceType
    };
};

const getChatNotificationBody = (
    type: MessageType,
    content: IChatMessage['content'],
    filename: string
): string => {
    if (type === 'TEXT' && typeof content === 'string') {
        return content.trim() || 'Nuevo mensaje';
    }

    switch (type) {
        case 'IMAGE':
            return '📷 Foto';
        case 'VIDEO':
        case 'MEDIA':
            return '🎥 Video';
        case 'AUDIO':
            return '🎤 Nota de voz';
        case 'FILE':
            return filename ? `📎 ${filename}` : '📎 Archivo';
        case 'STICKER':
            return typeof content === 'string' ? content : '✨ Sticker';
        case 'REACTION':
            return 'Reacción';
        case 'TEXT':
            return 'Nuevo mensaje';
    }
};

const hasObjectId = (
    values: readonly Types.ObjectId[],
    value: Types.ObjectId
): boolean => values.some((item) => item.equals(value));

const hasReceipt = (
    receipts: readonly ChatReceiptEntry[],
    userId: Types.ObjectId
): boolean => receipts.some((receipt) => receipt.user.equals(userId));

const ensureRecipientSnapshots = async (
    messages: readonly IChatMessage[],
    choirId: Types.ObjectId
): Promise<void> => {
    const messagesWithoutSnapshot = messages.filter(
        (message) => message.recipientUserIds.length === 0
    );

    if (messagesWithoutSnapshot.length === 0) {
        return;
    }

    const activeRecipientIds = await findActiveChoirRecipientIds(choirId);

    await Promise.all(messagesWithoutSnapshot.map(async (message) => {
        const authorReference = message.author as Types.ObjectId | PopulatedAuthorReference;
        const authorId = authorReference instanceof Types.ObjectId
            ? authorReference
            : authorReference._id;
        const recipientUserIds = activeRecipientIds.filter(
            (recipientUserId) => !recipientUserId.equals(authorId)
        );
        message.recipientUserIds = [...recipientUserIds];
        await ChatMessage.updateOne(
            { _id: message._id, recipientUserIds: { $size: 0 } },
            { $set: { recipientUserIds } }
        );
    }));
};

const getReceiptTimestamp = (
    receipts: readonly ChatReceiptEntry[],
    userId: Types.ObjectId
): string | null => {
    const receipt = receipts.find((item) => item.user.equals(userId));
    return receipt ? receipt.at.toISOString() : null;
};

export const listChatHistoryController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const syncStartedAt = new Date();
    const { updatedSince } = parseSyncQuery(req);
    const limitValue = typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : 50;
    const limit = Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 100)
        : 50;
    const beforeValue = typeof req.query.before === 'string'
        ? req.query.before
        : undefined;
    const filters: FilterQuery<IChatMessage> = {
        choirId,
        ...buildUpdatedSinceFilter(updatedSince)
    };

    if (beforeValue) {
        const before = new Date(beforeValue);

        if (Number.isNaN(before.getTime())) {
            throw new AppError(
                400,
                'INVALID_BEFORE_DATE',
                'before must be a valid date'
            );
        }

        filters.createdAt = { $lt: before };
    }

    const messages = await ChatMessage.find(filters)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('author', 'name username imageUrl')
        .populate('reactions.user', 'username name imageUrl')
        .populate(replyPopulate)
        .populate(chatMediaPopulate);

    await ensureRecipientSnapshots(messages, choirId);
    sendCacheableJson(req, res, messages.reverse(), syncStartedAt);
};

export const listChatMediaController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const syncStartedAt = new Date();
    const { updatedSince } = parseSyncQuery(req);
    const limitValue = typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : 100;
    const limit = Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 200)
        : 100;
    const beforeValue = typeof req.query.before === 'string'
        ? req.query.before
        : undefined;
    const filters: FilterQuery<IChatMessage> = {
        choirId,
        type: { $in: ['IMAGE', 'FILE', 'MEDIA', 'AUDIO', 'VIDEO'] },
        ...buildUpdatedSinceFilter(updatedSince)
    };

    if (beforeValue) {
        const before = new Date(beforeValue);

        if (Number.isNaN(before.getTime())) {
            throw new AppError(
                400,
                'INVALID_BEFORE_DATE',
                'before must be a valid date'
            );
        }

        filters.createdAt = { $lt: before };
    }

    const messages = await ChatMessage.find(filters)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('author', 'name username imageUrl')
        .populate('reactions.user', 'username name imageUrl')
        .populate(replyPopulate)
        .populate(chatMediaPopulate);

    await ensureRecipientSnapshots(messages, choirId);
    sendCacheableJson(req, res, messages, syncStartedAt);
};

export const createChatMessageController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseChatMessageInput(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const requiresMedia = ['IMAGE', 'FILE', 'MEDIA', 'AUDIO', 'VIDEO'].includes(input.type);

    if (requiresMedia && !input.mediaAssetId) {
        throw new AppError(
            400,
            'CHAT_MEDIA_REQUIRED',
            'A mediaAssetId is required for this chat message type'
        );
    }

    if (!requiresMedia && input.mediaAssetId) {
        throw new AppError(
            400,
            'CHAT_MEDIA_NOT_ALLOWED',
            'This chat message type cannot include media'
        );
    }

    const asset = input.mediaAssetId
        ? await getPendingMediaAsset(
            input.mediaAssetId,
            choirId,
            actorUserId,
            'CHAT'
        )
        : null;

    if (asset) {
        assertChatMediaMatchesType(input.type, asset.mimeType);
    }

    const recipientUserIds = await findActiveChoirRecipientIds(
        choirId,
        [actorUserId]
    );
    const now = new Date();
    const message = await ChatMessage.create({
        content: input.content,
        type: input.type,
        filename: asset?.originalName ?? '',
        fileUrl: asset && ['FILE', 'MEDIA', 'VIDEO'].includes(input.type)
            ? asset.url
            : '',
        imageUrl: asset && input.type === 'IMAGE' ? asset.url : '',
        audioUrl: asset && input.type === 'AUDIO' ? asset.url : '',
        mediaPublicId: asset?.publicId ?? '',
        mediaResourceType: asset?.resourceType ?? null,
        mediaAssetId: asset?._id ?? null,
        replyTo: input.replyTo
            ? parseObjectId(input.replyTo, 'replyTo')
            : null,
        author: actorUserId,
        createdBy: actorUserId,
        choirId,
        reactions: [],
        recipientUserIds,
        deliveredTo: [actorUserId],
        readBy: [actorUserId],
        deliveryReceipts: [{ user: actorUserId, at: now }],
        readReceipts: [{ user: actorUserId, at: now }]
    }).catch(async (error: Error) => {
        if (asset) {
            await discardPendingMedia(asset._id, choirId, 'Chat message creation failed');
        }
        throw error;
    });

    if (asset) {
        await attachMediaAsset(asset._id, choirId, 'CHAT', message._id);
    }

    await populateMessage(message);
    emitMessage(req, 'new-message', message);

    await registerLog({
        req,
        collection: 'ChatMessages',
        action: 'create',
        referenceId: message.id,
        changes: { after: message.toObject() }
    });

    const senderName = req.user?.name ?? req.user?.username ?? 'Usuario';
    await createNotifications({
        choirId,
        actorUserId,
        recipientUserIds,
        category: 'CHAT',
        type: 'CHAT_MESSAGE',
        title: `Nuevo mensaje de ${senderName}`,
        body: getChatNotificationBody(input.type, input.content, asset?.originalName ?? ''),
        resourceId: message._id,
        dedupeKey: `CHAT_MESSAGE:${message.id}`,
        io: getSocketServer(req)
    });

    await notifyCommunity(
        requireEffectiveChoirId(req),
        req.user?.id,
        req.user?.username ?? req.user?.name ?? 'User',
        'CHAT',
        message
    );

    res.status(201).json({ message });
};

export const markChatReceiptsController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseChatReceiptInput(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const messageIds = input.messageIds.map((messageId) =>
        parseObjectId(messageId, 'messageIds')
    );
    const messages = await ChatMessage.find({
        _id: { $in: messageIds },
        choirId,
        author: { $ne: actorUserId }
    });
    const now = new Date();

    for (const message of messages) {
        if (!hasObjectId(message.deliveredTo, actorUserId)) {
            message.deliveredTo.push(actorUserId);
        }

        if (!hasReceipt(message.deliveryReceipts, actorUserId)) {
            message.deliveryReceipts.push({ user: actorUserId, at: now });
        }

        if (input.status === 'READ') {
            if (!hasObjectId(message.readBy, actorUserId)) {
                message.readBy.push(actorUserId);
            }

            if (!hasReceipt(message.readReceipts, actorUserId)) {
                message.readReceipts.push({ user: actorUserId, at: now });
            }
        }

        await message.save();
        await populateMessage(message);
        emitMessage(req, 'message-updated', message);
    }

    if (input.status === 'READ') {
        await markNotificationResourcesRead(
            actorUserId,
            choirId,
            'CHAT',
            messageIds,
            getSocketServer(req)
        );
    }

    res.json({ messages });
};

export const getChatMessageDetailsController = async (
    req: RequestWithUser & { params: ChatMessageParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const message = await ChatMessage.findOne({
        _id: parseObjectId(req.params.messageId, 'messageId'),
        choirId,
        author: actorUserId
    });

    if (!message) {
        throw new AppError(404, 'CHAT_MESSAGE_NOT_FOUND', 'Message not found');
    }

    await ensureRecipientSnapshots([message], choirId);
    const recipients = await User.find({
        _id: { $in: message.recipientUserIds },
        choirId
    })
        .select('name username imageUrl')
        .sort({ name: 1 });
    const details: readonly MessageRecipientDetail[] = recipients.map((recipient) => {
        const read = hasObjectId(message.readBy, recipient._id);
        const delivered = hasObjectId(message.deliveredTo, recipient._id);

        return {
            user: {
                id: recipient.id,
                name: recipient.name,
                username: recipient.username,
                imageUrl: recipient.imageUrl ?? ''
            },
            status: read ? 'READ' : delivered ? 'DELIVERED' : 'PENDING',
            deliveredAt: getReceiptTimestamp(message.deliveryReceipts, recipient._id),
            readAt: getReceiptTimestamp(message.readReceipts, recipient._id)
        };
    });

    res.json({
        messageId: message.id,
        createdAt: message.createdAt.toISOString(),
        recipientCount: details.length,
        deliveredCount: details.filter((detail) => detail.status !== 'PENDING').length,
        readCount: details.filter((detail) => detail.status === 'READ').length,
        recipients: details
    });
};

export const uploadChatImageController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    res.status(201).json(await uploadChatAsset(req));
};

export const uploadChatMediaController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    res.status(201).json(await uploadChatAsset(req));
};

export const uploadChatFileController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    res.status(201).json(await uploadChatAsset(req));
};

export const toggleChatReactionController = async (
    req: RequestWithUser & { params: ChatMessageParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const userId = requireAuthenticatedUserId(req);
    const emoji = readRequiredString(parseRequestBody(req), 'emoji');
    const message = await ChatMessage.findOne({
        _id: parseObjectId(req.params.messageId, 'messageId'),
        choirId
    });

    if (!message) {
        throw new AppError(404, 'CHAT_MESSAGE_NOT_FOUND', 'Message not found');
    }

    const existingIndex = message.reactions.findIndex((reaction) =>
        reaction.user.equals(userId)
    );
    let action: ReactionLogAction = 'add_reaction';

    if (existingIndex >= 0) {
        const existingReaction = message.reactions[existingIndex];

        if (existingReaction.emoji === emoji) {
            message.reactions.splice(existingIndex, 1);
            action = 'remove_reaction';
        } else {
            existingReaction.emoji = emoji;
        }
    } else {
        message.reactions.push({ user: userId, emoji });
    }

    const messageAuthorId = message.author;
    await message.save();
    await populateMessage(message);
    emitMessage(req, 'message-updated', message);

    const dedupeKey = `CHAT_REACTION:${message.id}:${userId.toString()}`;

    if (!messageAuthorId.equals(userId)) {
        if (action === 'remove_reaction') {
            await removeNotification({
                recipientUserId: messageAuthorId,
                dedupeKey,
                io: getSocketServer(req)
            });
        } else {
            await createNotifications({
                choirId,
                actorUserId: userId,
                recipientUserIds: [messageAuthorId],
                category: 'CHAT',
                type: 'CHAT_REACTION',
                title: `${req.user?.name ?? 'Alguien'} reaccionó a tu mensaje`,
                body: emoji,
                resourceId: message._id,
                dedupeKey,
                io: getSocketServer(req)
            });
        }
    }

    await registerLog({
        req,
        collection: 'ChatMessages',
        action,
        referenceId: message.id,
        changes: { emoji, userId: userId.toString() }
    });

    res.json({ message });
};
