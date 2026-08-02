// src/routes/auth.ts

import { Router } from 'express';
import {
    bootstrapSuperAdminController,
    getCurrentSessionController,
    logoutController,
    refreshSessionController
} from '../controllers/auth.controller';
import { verifyPlatformToken } from '../middlewares/auth';

const router = Router();

router.post('/bootstrap', bootstrapSuperAdminController);
router.post('/refresh', refreshSessionController);
router.post('/logout', verifyPlatformToken, logoutController);
router.get('/me', verifyPlatformToken, getCurrentSessionController);

export default router;
