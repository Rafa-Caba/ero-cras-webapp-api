import Log from '../models/Log';
import { Request } from 'express';

export interface RequestWithUser extends Request {
    user?: {
        id: string;
        name: string;
        username: string;
        role: string;
    };
    // Kept for backward compatibility if middleware still attaches 'usuario'
    usuario?: any; 
}

export const registerLog = async ({
    req,
    collection,
    action,
    referenceId,
    changes = {}
}: {
    req: RequestWithUser;
    collection: string;
    action: 'create' | 'update' | 'delete' | 'add_reaction' | 'remove_reaction';
    referenceId: string;
    changes?: Record<string, any>;
}) => {
    try {
        const currentUser = req.user || req.usuario; 
        
        if (!currentUser) return;

        await Log.create({
            user: currentUser.id,
            collectionName: collection,
            action,
            referenceId,
            changes
        });
    } catch (error) {
        console.error('Error registering log:', error);
    }
};