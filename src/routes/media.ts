// src/routes/media.ts

import { Router } from 'express';
import {
    cleanupOrphanedMediaController,
    listOrphanedMediaController
} from '../controllers/media.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';

const router = Router();
const requireMediaManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/', verifyTenantToken, requireMediaManager, listOrphanedMediaController);
router.post(
    '/:id/cleanup',
    verifyTenantToken,
    requireMediaManager,
    cleanupOrphanedMediaController
);

export default router;
