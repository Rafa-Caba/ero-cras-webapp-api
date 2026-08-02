// src/routes/auth.ts

import { Router } from 'express';
import {
    bootstrapSuperAdminController,
    changePasswordController,
    getCurrentSessionController,
    loginPlatformController,
    loginTenantController,
    logoutController,
    refreshSessionController
} from '../controllers/auth.controller';
import { verifySessionToken } from '../middlewares/auth';

const router = Router();

router.post('/bootstrap', bootstrapSuperAdminController);
router.post('/login', loginTenantController);
router.post('/platform-login', loginPlatformController);
router.post('/refresh', refreshSessionController);
router.post('/change-password', verifySessionToken, changePasswordController);
router.post('/logout', verifySessionToken, logoutController);
router.get('/me', verifySessionToken, getCurrentSessionController);

export default router;
