// src/routes/song.ts

import express from 'express';
import {
    createSongController,
    deleteSongController,
    getSongController,
    listPublicSongsController,
    listSongsController,
    updateSongController
} from '../controllers/song.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadSongAudio } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireContentEditor = requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR');

router.get('/public', listPublicSongsController);
router.get('/public/:choirKey', listPublicSongsController);
router.get('/', verifyTenantToken, listSongsController);
router.get('/:id', verifyTenantToken, getSongController);
router.post(
    '/',
    verifyTenantToken,
    requireContentEditor,
    uploadSongAudio.single('file'),
    createSongController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    uploadSongAudio.single('file'),
    updateSongController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    deleteSongController
);

export default router;
