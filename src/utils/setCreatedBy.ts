import { Request, Response, NextFunction } from 'express';

export interface RequestWithUser extends Request {
    user?: {
        id: string;
        name: string;
        username: string;
        role: string;
    };
    usuario?: any;
}

export const setCreatedBy = (req: RequestWithUser, res: Response, next: NextFunction) => {
    const currentUser = req.user || req.usuario;
    
    if (currentUser && req.method === 'POST') {
        req.body.createdBy = currentUser.id;
    }
    next();
};

export const setUpdatedBy = (req: RequestWithUser, res: Response, next: NextFunction) => {
    const currentUser = req.user || req.usuario;

    if (currentUser && (req.method === 'PUT' || req.method === 'PATCH')) {
        req.body.updatedBy = currentUser.id;
    }
    next();
};