// src/routes/blog.ts

import express from 'express';
import {
    addBlogCommentController,
    createBlogPostController,
    deleteBlogPostController,
    getBlogPostController,
    listBlogController,
    listPublicBlogController,
    toggleBlogLikeController,
    updateBlogPostController
} from '../controllers/blog.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadBlogImage } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireContentEditor = requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR');

router.get('/public', listPublicBlogController);
router.get('/public/:choirKey', listPublicBlogController);
router.get('/', verifyTenantToken, listBlogController);
router.get('/:id', verifyTenantToken, getBlogPostController);
router.post(
    '/',
    verifyTenantToken,
    requireContentEditor,
    uploadBlogImage.single('file'),
    createBlogPostController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    uploadBlogImage.single('file'),
    updateBlogPostController
);
router.put('/:id/like', verifyTenantToken, toggleBlogLikeController);
router.post('/:id/comment', verifyTenantToken, addBlogCommentController);
router.delete(
    '/:id',
    verifyTenantToken,
    requireContentEditor,
    deleteBlogPostController
);

export default router;
