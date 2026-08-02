// src/routes/songType.ts

import express from 'express';
import {
    createSongTypeController,
    deleteSongTypeController,
    getSongTypeController,
    listPublicSongTypesController,
    listSongTypesController,
    updateSongTypeController
} from '../controllers/songType.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireSongTypeManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/public', listPublicSongTypesController);
router.get('/public/:choirKey', listPublicSongTypesController);
router.get('/', verifyTenantToken, listSongTypesController);
router.get('/:id', verifyTenantToken, getSongTypeController);
router.post(
    '/',
    verifyTenantToken,
    requireSongTypeManager,
    createSongTypeController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireSongTypeManager,
    updateSongTypeController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireSongTypeManager,
    deleteSongTypeController
);

export default router;
