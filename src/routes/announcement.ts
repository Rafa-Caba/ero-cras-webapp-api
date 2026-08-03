// src/routes/announcement.ts

import express from 'express';
import {
    createAnnouncementController,
    deleteAnnouncementController,
    getAnnouncementController,
    listAnnouncementsController,
    updateAnnouncementController
} from '../controllers/announcement.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadAnnouncementImage } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireContentEditor = requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR');

router.get('/', verifyTenantToken, listAnnouncementsController);
router.get('/admin', verifyTenantToken, listAnnouncementsController);
router.get('/:id', verifyTenantToken, getAnnouncementController);
router.post(
    '/',
    verifyTenantToken,
    requireContentEditor,
    uploadAnnouncementImage.single('file'),
    createAnnouncementController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    uploadAnnouncementImage.single('file'),
    updateAnnouncementController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    deleteAnnouncementController
);

export default router;
