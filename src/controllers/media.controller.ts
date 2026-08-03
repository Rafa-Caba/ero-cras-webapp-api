// src/controllers/media.controller.ts

import type { Response } from 'express';
import {
    cleanupOrphanedMedia,
    listOrphanedMedia
} from '../services/media.service';
import { requireEffectiveChoirObjectId } from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';

interface MediaParams {
    readonly id: string;
}

export const listOrphanedMediaController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const assets = await listOrphanedMedia(
        requireEffectiveChoirObjectId(req)
    );

    res.json({ assets });
};

export const cleanupOrphanedMediaController = async (
    req: RequestWithUser & { params: MediaParams },
    res: Response
): Promise<void> => {
    const asset = await cleanupOrphanedMedia(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );

    await registerLog({
        req,
        collection: 'MediaAssets',
        action: 'delete',
        referenceId: asset.id,
        changes: { status: asset.status }
    });

    res.json({ message: 'Orphaned media cleaned successfully' });
};
