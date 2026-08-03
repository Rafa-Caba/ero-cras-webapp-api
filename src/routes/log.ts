// src/routes/log.ts

import express from 'express';
import {
    listLogsController,
    listPlatformLogsController,
    listUserLogsController
} from '../controllers/log.controller';
import { verifyPlatformToken, verifyTenantToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireLogManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get(
    '/platform',
    verifyPlatformToken,
    requireRole('SUPER_ADMIN'),
    listPlatformLogsController
);
router.get('/', verifyTenantToken, requireLogManager, listLogsController);
router.get(
    '/user/:userId',
    verifyTenantToken,
    requireLogManager,
    listUserLogsController
);

export default router;
