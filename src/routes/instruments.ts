// src/routes/instruments.ts

import express from 'express';
import {
    createInstrumentController,
    deleteInstrumentController,
    getInstrumentController,
    listInstrumentsController,
    updateInstrumentController
} from '../controllers/instrument.controller';
import { verifyTenantToken } from '../middlewares/auth';
import { uploadInstrumentIcon } from '../middlewares/cloudinaryStorage';
import { requireRole } from '../middlewares/requireRole';

const router = express.Router();
const requireInstrumentManager = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/', verifyTenantToken, listInstrumentsController);
router.get('/:id', verifyTenantToken, getInstrumentController);
router.post(
    '/',
    verifyTenantToken,
    requireInstrumentManager,
    uploadInstrumentIcon.single('file'),
    createInstrumentController
);
router.put(
    '/:id',
    verifyTenantToken,
    requireInstrumentManager,
    uploadInstrumentIcon.single('file'),
    updateInstrumentController
);
router.delete(
    '/:id',
    verifyTenantToken,
    requireInstrumentManager,
    deleteInstrumentController
);

export default router;
