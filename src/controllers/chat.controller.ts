// src/controllers/chat.controller.ts

import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import type { Server as SocketIOServer } from 'socket.io';
import { AppError } from '../errors/AppError';
import {
    streamUpload
} from '../middlewares/cloudinaryStorage';
import ChatMessage, { type IChatMessage } from '../models/ChatMessage';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import {
    parseObjectId,
    parseRequestBody,
    readRequiredString
} from '../validations/schemas/common.schemas';
import { parseChatMessageInput } from '../validations/schemas/resource.schemas';

interface ChatMessageParams {
    readonly messageId: string;
}

interface UploadChatResponse {
    readonly fileUrl: string;
    readonly filename: string;
    readonly cloudinaryPublicId: string;
}

type ReactionLogAction = 'add_reaction' | 'remove_reaction';

const getSocketServer = (req: RequestWithUser): SocketIOServer | undefined => {
    const io: SocketIOServer | undefined = req.app.get('io');
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

    if (!io) {
        return;
    }

    io.to(`choir:${requireEffectiveChoirId(req)}`).emit(
        eventName,
        message.toJSON()
    );
};

const requireUpload = (req: RequestWithUser): Express.Multer.File => {
    if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'A file is required');
    }

    return req.file;
};

const buildUploadResponse = (file: Express.Multer.File): UploadChatResponse => {
    return {
        fileUrl: file.path,
        filename: file.originalname || file.filename,
        cloudinaryPublicId: file.filename || ''
    };
};

export const listChatHistoryController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const limitValue = typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : 50;
    const limit = Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 100)
        : 50;
    const beforeValue = typeof req.query.before === 'string'
        ? req.query.before
        : undefined;
    const filters: FilterQuery<IChatMessage> = { choirId };

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

    res.json(messages.reverse());
};

export const createChatMessageController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const input = parseChatMessageInput(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const message = await ChatMessage.create({
        ...input,
        replyTo: input.replyTo
            ? parseObjectId(input.replyTo, 'replyTo')
            : null,
        author: actorUserId,
        createdBy: actorUserId,
        choirId: requireEffectiveChoirObjectId(req),
        reactions: []
    });

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
    res.status(201).json(buildUploadResponse(requireUpload(req)));
};

export const uploadChatMediaController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    res.status(201).json(buildUploadResponse(requireUpload(req)));
};

export const uploadChatFileController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const file = requireUpload(req);
    const result = await streamUpload(
        file.buffer,
        file.originalname,
        'auto'
    );

    res.status(201).json({
        fileUrl: result.secure_url,
        filename: file.originalname,
        cloudinaryPublicId: result.public_id
    });
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
