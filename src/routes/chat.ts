// src/routes/chat.ts

import express, { Response } from 'express';
import { Types } from 'mongoose';

import ChatMessage from '../models/ChatMessage';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy } from '../utils/setCreatedBy';
import {
    streamUpload,
    uploadChatFile,
    uploadChatImage,
    uploadChatMedia,
} from '../middlewares/cloudinaryStorage';
import { VALID_MESSAGE_TYPES } from '../utils/constants';
import { notifyCommunity } from '../utils/notificationHelper';

const router = express.Router();

interface ChatHistoryQuery {
    limit?: string | number;
    before?: string;
    choirId?: string;
    choirKey?: string;
}

interface CreateChatMessageBody {
    author?: string;
    createdBy?: string;
    content?: object;
    type?: string;
    fileUrl?: string;
    filename?: string;
    replyToId?: string;
}

interface UploadChatResponse {
    fileUrl: string;
    filename: string;
    cloudinaryPublicId: string;
}

interface ReactionBody {
    emoji?: string;
}

interface ChoirLeanResult {
    _id: Types.ObjectId;
}

interface ChatMessageWithToJSON {
    toJSON: () => object;
}

const getChoirRoom = (choirId: string | null | undefined): string =>
    `choir:${choirId || 'global'}`;

const resolveChoirIdFromKey = async (choirKey?: string | null): Promise<string | null> => {
    if (!choirKey) {
        return null;
    }

    if (Types.ObjectId.isValid(choirKey)) {
        return choirKey;
    }

    const choir = await Choir.findOne({
        $or: [{ code: choirKey }, { name: choirKey }],
    })
        .select('_id')
        .lean<ChoirLeanResult | null>();

    return choir ? choir._id.toString() : null;
};

const getRequestChoirId = (req: RequestWithUser): string | null => {
    if (!req.user?.choirId) {
        return null;
    }

    return req.user.choirId.toString();
};

const getUploadFileName = (file: Express.Multer.File): string => {
    return file.originalname || file.filename;
};

const getUploadPublicId = (file: Express.Multer.File): string => {
    return file.filename || '';
};

const sendUploadResponse = (
    res: Response,
    file: Express.Multer.File,
): void => {
    const response: UploadChatResponse = {
        fileUrl: file.path,
        filename: getUploadFileName(file),
        cloudinaryPublicId: getUploadPublicId(file),
    };

    res.status(201).json(response);
};

router.get(
    ['/', '/history'],
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const {
                limit = 50,
                before,
                choirId,
                choirKey,
            } = req.query as ChatHistoryQuery;

            const query: {
                choirId?: string;
                createdAt?: { $lt: Date };
            } = {};

            if (req.user?.role === 'SUPER_ADMIN') {
                let targetChoirId: string | null = null;

                if (choirId && typeof choirId === 'string' && choirId.trim() !== '') {
                    targetChoirId = choirId;
                } else if (choirKey && typeof choirKey === 'string' && choirKey.trim() !== '') {
                    targetChoirId = await resolveChoirIdFromKey(choirKey);
                } else if (req.user?.choirId) {
                    targetChoirId = req.user.choirId.toString();
                }

                if (targetChoirId) {
                    query.choirId = targetChoirId;
                }
            } else if (req.user?.choirId) {
                query.choirId = req.user.choirId.toString();
            }

            if (before) {
                query.createdAt = { $lt: new Date(before) };
            }

            const messages = await ChatMessage.find(query)
                .sort({ createdAt: -1 })
                .limit(Number(limit))
                .populate('author', 'name username imageUrl')
                .populate('reactions.user', 'username')
                .populate({
                    path: 'replyTo',
                    populate: { path: 'author', select: 'name username imageUrl' },
                });

            res.json(messages.reverse());
        } catch (error) {
            console.error('History Error:', error);

            res.status(500).json({
                message: 'Error retrieving messages',
            });
        }
    },
);

router.post(
    '/',
    verifyToken,
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = req.body as CreateChatMessageBody;
            const author = body.author || body.createdBy;

            if (!body.type || !VALID_MESSAGE_TYPES.includes(body.type)) {
                res.status(400).json({ message: 'Invalid message type' });
                return;
            }

            if (!author) {
                res.status(400).json({ message: 'Author is required' });
                return;
            }

            const choirId = getRequestChoirId(req);

            const message = new ChatMessage({
                author,
                choirId,
                content: body.content || {},
                type: body.type,
                fileUrl: body.fileUrl || '',
                filename: body.filename || '',
                replyTo: body.replyToId || null,
                createdBy: body.createdBy,
            });

            await message.save();

            await message.populate([
                { path: 'author', select: 'name username imageUrl' },
                {
                    path: 'replyTo',
                    populate: { path: 'author', select: 'name username imageUrl' },
                },
            ]);

            const io = req.app.get('io');

            if (io) {
                const choirRoom = getChoirRoom(choirId);
                const jsonMessage = (message as ChatMessageWithToJSON).toJSON();

                io.to(choirRoom).emit('new-message', jsonMessage);
            }

            notifyCommunity(
                req.user?.id,
                req.user?.username || 'User',
                'CHAT',
                message,
            );

            res.status(201).json({ message });
        } catch (error) {
            console.error('Create Chat Message Error:', error);

            res.status(500).json({
                message: 'Error creating message',
            });
        }
    },
);

router.post(
    '/upload-image',
    verifyToken,
    uploadChatImage.single('file'),
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No image received' });
                return;
            }

            sendUploadResponse(res, req.file);
        } catch (error) {
            console.error('Upload Chat Image Error:', error);

            res.status(500).json({
                message: 'Error uploading chat image',
            });
        }
    },
);

router.post(
    '/upload-media',
    verifyToken,
    uploadChatMedia.single('file'),
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No media received' });
                return;
            }

            sendUploadResponse(res, req.file);
        } catch (error) {
            console.error('Upload Chat Media Error:', error);

            res.status(500).json({
                message: 'Error uploading chat media',
            });
        }
    },
);

router.post(
    '/upload-file',
    verifyToken,
    uploadChatFile.single('file'),
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file received' });
                return;
            }

            const uploadResult = await streamUpload(
                req.file.buffer,
                req.file.originalname,
                'auto',
            );

            const response: UploadChatResponse = {
                fileUrl: uploadResult.secure_url,
                filename: req.file.originalname,
                cloudinaryPublicId: uploadResult.public_id,
            };

            res.status(201).json(response);
        } catch (error) {
            console.error('Upload Chat File Error:', error);

            res.status(500).json({
                message: 'Error uploading chat file',
            });
        }
    },
);

router.patch(
    '/:messageId/reaction',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { messageId } = req.params;
            const body = req.body as ReactionBody;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            if (!body.emoji || body.emoji.trim() === '') {
                res.status(400).json({ message: 'Emoji is required' });
                return;
            }

            const message = await ChatMessage.findById(messageId);

            if (!message) {
                res.status(404).json({ message: 'Message not found' });
                return;
            }

            const existingReactionIndex = message.reactions.findIndex((reaction) => {
                const reactionUser = reaction.user;

                if (reactionUser instanceof Types.ObjectId) {
                    return reactionUser.toString() === userId;
                }

                return String(reactionUser) === userId;
            });

            if (existingReactionIndex >= 0) {
                const currentReaction = message.reactions[existingReactionIndex];

                if (currentReaction.emoji === body.emoji) {
                    message.reactions.splice(existingReactionIndex, 1);
                } else {
                    currentReaction.emoji = body.emoji;
                }
            } else {
                message.reactions.push({
                    user: new Types.ObjectId(userId),
                    emoji: body.emoji,
                });
            }

            await message.save();

            await message.populate([
                { path: 'author', select: 'name username imageUrl' },
                { path: 'reactions.user', select: 'username name imageUrl' },
                {
                    path: 'replyTo',
                    populate: { path: 'author', select: 'name username imageUrl' },
                },
            ]);

            const io = req.app.get('io');

            if (io) {
                const choirRoom = getChoirRoom(getRequestChoirId(req));
                const jsonMessage = (message as ChatMessageWithToJSON).toJSON();

                io.to(choirRoom).emit('message-updated', jsonMessage);
            }

            res.json({ message });
        } catch (error) {
            console.error('Toggle Reaction Error:', error);

            res.status(500).json({
                message: 'Error updating reaction',
            });
        }
    },
);

export default router;