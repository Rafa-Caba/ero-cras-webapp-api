// src/routes/public.ts

import { Router } from 'express';
import {
    getPublicBlogPostController,
    getPublicSettingsController,
    listPublicAnnouncementsController,
    listPublicBlogController,
    listPublicGalleryController,
    listPublicInstrumentsController,
    listPublicMembersController,
    listPublicSongsController,
    listPublicSongTypesController,
    listPublicThemesController
} from '../controllers/public.controller';

const router = Router({ mergeParams: true });

router.get('/settings', getPublicSettingsController);
router.get('/announcements', listPublicAnnouncementsController);
router.get('/blog', listPublicBlogController);
router.get('/blog/:postId', getPublicBlogPostController);
router.get('/gallery', listPublicGalleryController);
router.get('/songs', listPublicSongsController);
router.get('/song-types', listPublicSongTypesController);
router.get('/themes', listPublicThemesController);
router.get('/members', listPublicMembersController);
router.get('/instruments', listPublicInstrumentsController);

export default router;
