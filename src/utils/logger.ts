import Log from '../models/Log';
import type { RequestWithUser } from '../middlewares/auth';

type RegisterLogPayload = {
    req: RequestWithUser;
    collection: string;
    action: 'create' | 'update' | 'delete' | 'add_reaction' | 'remove_reaction';
    referenceId: string;
    changes?: Record<string, any>;
    choirId?: string;
};

export const registerLog = async ({
    req,
    collection,
    action,
    referenceId,
    changes = {},
    choirId
}: RegisterLogPayload) => {
    try {
        const currentUser = (req.user || (req as any).usuario) as any;

        if (!currentUser) return;

        const effectiveChoirId = choirId ?? currentUser.choirId;

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
    } catch (error) {
        console.error('Error registering log:', error);
    }
};
