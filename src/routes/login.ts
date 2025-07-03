import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import verificarToken, { AuthenticatedRequest } from '../middlewares/auth';

import Usuario from '../models/Usuario';
import RefreshToken from '../models/RefreshToken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro' as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshUltraSeguro' as string;

// POST /api/login
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { usernameOrEmail, password } = req.body;

    try {
        const usuario = await Usuario.findOne({
            $or: [
                { correo: usernameOrEmail },
                { username: usernameOrEmail }
            ]
        });

        if (!usuario) {
            res.status(401).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            res.status(401).json({ mensaje: 'Contraseña incorrecta' });
            return;
        }

        const accessToken = jwt.sign(
            { id: usuario._id, username: usuario.username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: usuario._id, username: usuario.username },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        await RefreshToken.create({ token: refreshToken, userId: usuario._id });

        res.json({
            mensaje: 'Login exitoso',
            token: accessToken,
            refreshToken,
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                username: usuario.username,
                correo: usuario.correo,
                fotoPerfilUrl: usuario.fotoPerfilUrl
            }
        });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// POST /api/login/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.body.token;

    const decoded = jwt.decode(refreshToken) as JwtPayload | null;

    if (!decoded?.id) {
        res.status(403).json({ mensaje: 'Token inválido' });
        return;
    }

    const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: decoded.id
    });

    if (!storedToken) {
        res.status(403).json({ mensaje: 'Refresh token inválido' });
        return;
    }

    try {
        const user = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;

        const newAccessToken = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(403).json({ mensaje: 'Token expirado o inválido' });
    }
});

// POST /api/login/logout
router.post('/logout', verificarToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        await RefreshToken.deleteOne({ token: req.body.token });

        if (req.usuario && typeof req.usuario === 'object' && 'id' in req.usuario) {
            await RefreshToken.deleteMany({ userId: req.usuario.id });
        }

        res.json({ mensaje: 'Logout exitoso' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;
