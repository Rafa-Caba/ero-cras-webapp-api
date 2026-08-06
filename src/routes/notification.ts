// src/routes/notification.ts

import express from 'express';
import {
    listNotificationsController,
    markNotificationReadController,
    markNotificationsReadController
} from '../controllers/notification.controller';
import { verifyTenantToken } from '../middlewares/auth';

const router = express.Router();

router.get('/', verifyTenantToken, listNotificationsController);
router.patch('/read-all', verifyTenantToken, markNotificationsReadController);
router.patch('/:notificationId/read', verifyTenantToken, markNotificationReadController);

export default router;
