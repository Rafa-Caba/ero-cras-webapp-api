// src/routes/chat.ts

import express from 'express';
import {
    createChatMessageController,
    listChatHistoryController,
    listChatMediaController,
    markChatReceiptsController,
    toggleChatReactionController,
    uploadChatFileController,
    uploadChatImageController,
    uploadChatMediaController
} from '../controllers/chat.controller';
import { verifyTenantToken } from '../middlewares/auth';
import {
    uploadChatFile,
    uploadChatImage,
    uploadChatMedia
} from '../middlewares/cloudinaryStorage';

const router = express.Router();

router.get('/media', verifyTenantToken, listChatMediaController);
router.get(['/', '/history'], verifyTenantToken, listChatHistoryController);
router.post('/', verifyTenantToken, createChatMessageController);
router.patch('/receipts', verifyTenantToken, markChatReceiptsController);
router.post(
    '/upload-image',
    verifyTenantToken,
    uploadChatImage.single('file'),
    uploadChatImageController
);
router.post(
    '/upload-media',
    verifyTenantToken,
    uploadChatMedia.single('file'),
    uploadChatMediaController
);
router.post(
    '/upload-file',
    verifyTenantToken,
    uploadChatFile.single('file'),
    uploadChatFileController
);
router.patch(
    '/:messageId/reaction',
    verifyTenantToken,
    toggleChatReactionController
);

export default router;
