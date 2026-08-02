// src/utils/logger.ts

import Log from '../models/Log';
import type { RequestWithUser } from '../middlewares/auth';

interface RegisterLogPayload {
    readonly req: RequestWithUser;
    readonly collection: string;
    readonly action:
        | 'create'
        | 'update'
        | 'delete'
        | 'add_reaction'
        | 'remove_reaction';
    readonly referenceId: string;
    readonly changes?: object;
    readonly choirId?: string;
}

export const registerLog = async ({
    req,
    collection,
    action,
    referenceId,
    changes = {},
    choirId
}: RegisterLogPayload): Promise<void> => {
    try {
        const currentUser = req.user;

        if (!currentUser) {
            return;
        }

        const effectiveChoirId =
            choirId ??
            req.auth?.effectiveChoirId ??
            currentUser.choirId;

        if (!effectiveChoirId) {
            console.warn(
                `Skipping log for ${collection}/${action} - missing choirId (user: ${currentUser.id})`
            );
            return;
        }

        await Log.create({
            user: currentUser.id,
            choirId: effectiveChoirId,
            collectionName: collection,
            action,
            referenceId,
            changes
        });
    } catch {
        console.error('Error registering log');
    }
};
