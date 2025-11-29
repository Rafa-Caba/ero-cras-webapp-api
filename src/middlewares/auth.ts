import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';

export interface UserPayload extends JwtPayload {
    id: string;
    name: string;   
    username: string;
    role: string;   
}

export interface RequestWithUser extends Request {
    user?: UserPayload;
}

export type AuthenticatedRequest = RequestWithUser;

const verifyToken = (req: RequestWithUser, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(403).json({ message: 'Token not provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
        
        req.user = decoded;
        
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid Token' });
    }
};

export default verifyToken;