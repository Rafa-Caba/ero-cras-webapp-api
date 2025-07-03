import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';

export interface AuthenticatedRequest extends Request {
    usuario?: string | JwtPayload;
}

const verificarToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
        res.status(403).json({ mensaje: 'Token no proporcionado' });
        return;
    }

    try {
        const decodificado = jwt.verify(token, JWT_SECRET);
        req.usuario = decodificado;
        next();
    } catch (err) {
        res.status(401).json({ mensaje: 'Token inválido' });
    }
};

export default verificarToken;
