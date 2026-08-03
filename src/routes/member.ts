// src/routes/member.ts

import express from 'express';
import {
    createMemberController,
    deleteMemberController,
    getMemberController,
    listMembersController,
    updateMemberController
} from '../controllers/member.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadMemberImage } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireMemberManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/', verifyTenantToken, listMembersController);
router.get('/:id', verifyTenantToken, getMemberController);
router.post(
    '/',
    verifyTenantToken,
    requireMemberManager,
    uploadMemberImage.single('file'),
    createMemberController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireMemberManager,
    uploadMemberImage.single('file'),
    updateMemberController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireMemberManager,
    deleteMemberController
);

export default router;
