// src/routes/gallery.ts

import express from 'express';
import {
    createGalleryImageController,
    deleteGalleryImageController,
    getGalleryImageController,
    listGalleryController,
    markGalleryImageController,
    updateGalleryImageController
} from '../controllers/gallery.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadGalleryImage } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireContentEditor = requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR');

router.get('/', verifyTenantToken, listGalleryController);
router.get('/:id', verifyTenantToken, getGalleryImageController);
router.post(
    '/',
    verifyTenantToken,
    requireContentEditor,
    uploadGalleryImage.single('file'),
    createGalleryImageController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    uploadGalleryImage.single('file'),
    updateGalleryImageController
);
router.patch(
    '/mark/:field/:id',
    verifyTenantToken,
    requireContentEditor,
    markGalleryImageController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    deleteGalleryImageController
);

export default router;
