// src/routes/setting.ts

import express from 'express';
import {
    getSettingsController,
    updateSettingsController
} from '../controllers/settings.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadSettingsLogo } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireSettingsManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/', verifyTenantToken, getSettingsController);
router.put(
    '/',
    verifyTenantToken,
    requireSettingsManager,
    uploadSettingsLogo.single('file'),
    updateSettingsController
);

export default router;
