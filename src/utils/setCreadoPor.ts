import { Request, Response, NextFunction } from 'express';

export interface RequestConUsuario extends Request {
    usuario?: {
        id: string;
        nombre: string;
        username: string;
        rol: string;
    };
}

export const setCreadoPor = (req: RequestConUsuario, res: Response, next: NextFunction) => {
    if (req.usuario && req.method === 'POST') {
        req.body.creadoPor = req.usuario.id;
    }
    next();
};

export const setActualizadoPor = (req: RequestConUsuario, res: Response, next: NextFunction) => {
    if (req.usuario && (req.method === 'PUT' || req.method === 'PATCH')) {
        req.body.actualizadoPor = req.usuario.id;
    }
    next();
};