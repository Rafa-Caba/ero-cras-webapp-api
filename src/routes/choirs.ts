// src/routes/choirs.ts

import { Router } from 'express';
import {
    createChoirController,
    deactivateChoirController,
    getChoirController,
    listChoirsController,
    updateChoirController
} from '../controllers/choir.controller';
import { verifyPlatformToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { uploadChoirLogo } from '../middlewares/cloudinaryStorage';

const router = Router();

router.get('/', verifyPlatformToken, listChoirsController);
router.get('/:id', verifyPlatformToken, getChoirController);
router.post(
    '/',
    verifyPlatformToken,
    requireRole('SUPER_ADMIN'),
    uploadChoirLogo.single('file'),
    createChoirController
);
router.put(
    '/:id',
    verifyPlatformToken,
    requireRole('SUPER_ADMIN'),
    uploadChoirLogo.single('file'),
    updateChoirController
);
router.delete(
    '/:id',
    verifyPlatformToken,
    requireRole('SUPER_ADMIN'),
    deactivateChoirController
);

export default router;
