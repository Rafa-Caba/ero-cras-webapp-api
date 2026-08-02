// src/routes/theme.ts

import express from 'express';
import {
    createThemeController,
    deleteThemeController,
    getThemeController,
    listPublicThemesController,
    listThemesController,
    updateThemeController
} from '../controllers/theme.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireThemeManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/public', listPublicThemesController);
router.get('/public/:choirKey', listPublicThemesController);
router.get('/', verifyTenantToken, listThemesController);
router.get('/:id', verifyTenantToken, getThemeController);
router.post('/', verifyTenantToken, requireThemeManager, createThemeController);
router.put('/:id', verifyTenantToken, requireThemeManager, updateThemeController);
router.delete(
    '/:id',
    verifyTenantToken,
    requireThemeManager,
    deleteThemeController
);

export default router;
