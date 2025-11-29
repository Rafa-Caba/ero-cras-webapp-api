import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setCreatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import { 
    streamUpload, 
    uploadChatFile, 
    uploadChatImage, 
    uploadChatMedia 
} from '../middlewares/cloudinaryStorage';
import { VALID_MESSAGE_TYPES } from '../utils/constants'; 
import { isValidMediaExtension } from '../utils/validateMimeMedia'; 
import { notifyCommunity } from '../utils/notificationHelper';

const router = express.Router();

// GET HISTORY
router.get(['/', '/history'], verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = 50, before } = req.query;

        const query: any = {};
        if (before) {
            query.createdAt = { $lt: new Date(before as string) };
        }        

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            // Populate using English fields from User Model
            .populate('author', 'name username imageUrl') 
            .populate('reactions.user', 'username'); 

        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving messages', error });
    }
});

// CREATE MESSAGE (Text)
router.post('/', verifyToken, setCreatedBy, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { content, type, fileUrl, filename } = req.body;
        const author = req.body.author || req.body.createdBy;

        if (VALID_MESSAGE_TYPES && !VALID_MESSAGE_TYPES.includes(type)) {
            res.status(400).json({ message: 'Invalid message type' });
            return;
        }

        const message = new ChatMessage({
            author, content, type, fileUrl, filename,
            createdBy: req.body.createdBy
        });

        await message.save();
        await message.populate('author', 'name username imageUrl');

        if (req.app.get('io')) {
            req.app.get('io').emit('new-message', message.toJSON());
        }

        notifyCommunity(req.user?.id, req.user?.username || 'User', 'CHAT', message);

        res.status(201).json({ message });
    } catch (error: any) {
        res.status(500).json({ message: 'Error creating message', error: error.message });
    }
});

// UPLOAD IMAGE
router.post('/upload-image', verifyToken, uploadChatImage.single('file'), setCreatedBy, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { content } = req.body;
        const author = req.body.author || req.body.createdBy;

        if (!req.file) { res.status(400).json({ message: 'No image received' }); return; }

        const message = new ChatMessage({
            author,
            content: content ? JSON.parse(content) : {},
            type: 'IMAGE',
            fileUrl: req.file.path,
            filename: req.file.filename,
            createdBy: req.body.createdBy,
        });

        await message.save();
        await message.populate('author', 'name username imageUrl');

        if (req.app.get('io')) req.app.get('io').emit('new-message', message.toJSON());

        notifyCommunity(req.user?.id, req.user?.username || 'User', 'CHAT', message);

        res.status(201).json({ message });
    } catch (error: any) {
        res.status(500).json({ message: 'Error uploading chat image', error: error.message });
    }
});

// UPLOAD FILE
router.post('/upload-file', verifyToken, uploadChatFile.single('file'), setCreatedBy, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const author = req.body.author || req.body.createdBy;
        if (!req.file) { res.status(400).json({ message: 'No file received' }); return; }

        const result = await streamUpload(req.file.buffer, req.file.originalname, 'auto');

        const message = new ChatMessage({
            author, content: {}, type: 'FILE',
            fileUrl: result.secure_url,
            filename: req.file.originalname,
            createdBy: req.body.createdBy,
        });

        await message.save();
        await message.populate('author', 'name username imageUrl');

        if (req.app.get('io')) req.app.get('io').emit('new-message', message.toJSON());

        notifyCommunity(req.user?.id, req.user?.username || 'User', 'CHAT', message);

        res.status(201).json({ message });
    } catch (error: any) {
        res.status(500).json({ message: 'Internal error uploading file', error: error.message });
    }
});

// UPLOAD MEDIA
router.post('/upload-media', verifyToken, uploadChatMedia.single('file'), setCreatedBy, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const author = req.body.author || req.body.createdBy;
        if (!req.file) { res.status(400).json({ message: 'No media received' }); return; }
        if (!isValidMediaExtension(req.file.originalname)) { res.status(400).json({ message: 'Invalid extension' }); return; }

        const mime = req.file.mimetype || '';
        const isVideo = mime.includes('video') || mime.includes('mp4') || mime.includes('mov');
        const type = isVideo ? 'VIDEO' : 'AUDIO';

        const message = new ChatMessage({
            author, content: {}, type,
            fileUrl: req.file.path,
            filename: req.file.originalname,
            createdBy: req.body.createdBy,
        });

        await message.save();
        await message.populate('author', 'name username imageUrl');

        if (req.app.get('io')) req.app.get('io').emit('new-message', message.toJSON());

        notifyCommunity(req.user?.id, req.user?.username || 'User', 'CHAT', message);

        res.status(201).json({ message });
    } catch (error: any) {
        res.status(500).json({ message: 'Error uploading media', error: error.message });
    }
});

// PATCH: ADD/REMOVE REACTION
router.patch('/:id/reaction', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const messageId = req.params.id;
        const { emoji } = req.body;
        const userId = req.user?.id;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            res.status(404).json({ message: 'Message not found' });
            return;
        }

        if (!userId) return;

        const hasReacted = message.reactions?.some(r =>
            r.username === userId.toString() || 
            (r as any).user?.toString() === userId.toString()
        );
        
        await message.save();
        await message.populate('author', 'name username imageUrl');
        
        // Emit Update
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('message-updated', message.toJSON());
        }

        notifyCommunity(req.user?.id, req.user?.username || 'User', 'CHAT', message);

        res.json({ message });
    } catch (error) {
        res.status(500).json({ message: 'Error updating reactions', error });
    }
});

export default router;