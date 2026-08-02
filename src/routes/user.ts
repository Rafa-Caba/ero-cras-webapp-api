// src/routes/user.ts

import express from 'express';
import {
    createUserController,
    deleteUserController,
    getOwnProfileController,
    getUserController,
    listDirectoryController,
    listUsersController,
    resetUserPasswordController,
    searchUsersController,
    setUserActiveStatusController,
    updateOwnProfileController,
    updateOwnPushTokenController,
    updateOwnThemeController,
    updateUserController
} from '../controllers/user.controller';
import { verifyPlatformToken, verifyTenantToken } from '../middlewares/auth';
import { uploadUserImage } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireUserManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/me', verifyPlatformToken, getOwnProfileController);
router.put('/me/push-token', verifyPlatformToken, updateOwnPushTokenController);
router.put('/me/theme', verifyTenantToken, updateOwnThemeController);
router.put(
    '/me',
    verifyPlatformToken,
    uploadUserImage.single('file'),
    updateOwnProfileController
);
router.get('/search', verifyTenantToken, searchUsersController);
router.get('/directory', verifyTenantToken, listDirectoryController);
router.get('/', verifyTenantToken, requireUserManager, listUsersController);
router.get('/:id', verifyTenantToken, requireUserManager, getUserController);
router.post(
    '/',
    verifyTenantToken,
    requireUserManager,
    uploadUserImage.single('file'),
    createUserController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireUserManager,
    uploadUserImage.single('file'),
    updateUserController
);
router.patch(
    '/:id/status',
    verifyTenantToken,
    requireUserManager,
    setUserActiveStatusController
);
router.post(
    '/:id/reset-password',
    verifyTenantToken,
    requireUserManager,
    resetUserPasswordController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireUserManager,
    deleteUserController
);

export default router;
