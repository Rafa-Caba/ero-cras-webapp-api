// src/controllers/chat.controller.ts

import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { AppError } from '../errors/AppError';
import { buildUpdatedSinceFilter, sendCacheableJson } from '../services/httpCache.service';
import ChatMessage, { type IChatMessage, type MessageType } from '../models/ChatMessage';
import {
    attachMediaAsset,
    discardPendingMedia,
    getPendingMediaAsset,
    uploadTenantMedia
} from '../services/media.service';
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
    readRequiredString
} from '../validations/schemas/common.schemas';
import { parseChatMessageInput } from '../validations/schemas/resource.schemas';
import { parseSyncQuery } from '../validations/schemas/sync.schemas';

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

const getSocketServer = (req: RequestWithUser): ChoirSocketServer | undefined => {
    const io: ChoirSocketServer | undefined = req.app.get('io');
    return io;
};

const populateMessage = async (message: IChatMessage): Promise<IChatMessage> => {
    await message.populate([
        { path: 'author', select: 'name username imageUrl' },
        { path: 'reactions.user', select: 'username name imageUrl' },
        {
            path: 'replyTo',
            populate: { path: 'author', select: 'name username imageUrl' }
        }
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
        .populate({
            path: 'replyTo',
            populate: { path: 'author', select: 'name username imageUrl' }
        });

    sendCacheableJson(req, res, messages.reverse(), syncStartedAt);
};

export const createChatMessageController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseChatMessageInput(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const requiresMedia = input.type !== 'TEXT' && input.type !== 'REACTION';

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
        reactions: []
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

    await notifyCommunity(
        requireEffectiveChoirId(req),
        req.user?.id,
        req.user?.username ?? req.user?.name ?? 'User',
        'CHAT',
        message
    );

    res.status(201).json({ message });
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

    await message.save();
    await populateMessage(message);
    emitMessage(req, 'message-updated', message);

    await registerLog({
        req,
        collection: 'ChatMessages',
        action,
        referenceId: message.id,
        changes: { emoji, userId: userId.toString() }
    });

    res.json({ message });
};
