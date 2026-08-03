// src/routes/pushDevice.ts

import { Router } from 'express';
import {
    listPushDevicesController,
    registerPushDeviceController,
    unregisterPushDeviceController
} from '../controllers/pushDevice.controller';
import { verifyTenantToken } from '../middlewares/auth';

const router = Router();

router.get('/', verifyTenantToken, listPushDevicesController);
router.post('/', verifyTenantToken, registerPushDeviceController);
router.delete('/:deviceId', verifyTenantToken, unregisterPushDeviceController);

export default router;
