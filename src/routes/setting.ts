// src/routes/setting.ts

import express from 'express';
import {
    getPublicSettingsController,
    getSettingsController,
    updateSettingsController
} from '../controllers/settings.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadChoirLogo } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireSettingsManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/public', getPublicSettingsController);
router.get('/public/:choirKey', getPublicSettingsController);
router.get('/', verifyTenantToken, getSettingsController);
router.put(
    '/',
    verifyTenantToken,
    requireSettingsManager,
    uploadChoirLogo.single('file'),
    updateSettingsController
);

export default router;
