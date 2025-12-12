import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
import Choir from '../models/Choir';
import { normalizeUserWithChoir } from '../utils/normalizeUser';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshUltraSeguro';

const ACCESS_TOKEN_EXPIRY = '1d';
const REFRESH_TOKEN_EXPIRY = '7d';

// REGISTER (Public - Mobile App)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name,
            username,
            email,
            password,
            instrument,
            choirCode
        } = req.body;

        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            res.status(400).json({ message: 'El usuario o correo ya existen' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'SUPER_ADMIN' : 'VIEWER';

        const codeToUse = choirCode || 'eroc1';
        const choir = await Choir.findOne({ code: codeToUse });

        if (!choir) {
            res.status(400).json({
                message: `No se encontró un coro con el código "${codeToUse}"`
            });
            return;
        }

        const newUser = new User({
            name,
            username,
            email,
            password: hashedPassword,
            role,
            instrument: instrument || '',
            choirId: choir._id
        });

        await newUser.save();

        const payload = {
            id: newUser.id,
            username: newUser.username,
            role: newUser.role,
            choirId: newUser.choirId?.toString()
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
            expiresIn: '15m'
        });

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_REFRESH_SECRET as string,
            {
                expiresIn: '7d'
            }
        );

        res.status(201).json({
            message: 'Usuario registrado correctamente',
            accessToken,
            refreshToken,
            role: newUser.role,
            user: newUser.toJSON()
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ message: error.message || 'Error al registrar usuario' });
    }
});

// LOGIN
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const usernameOrEmail = req.body.username || req.body.usernameOrEmail;
    const { password } = req.body;

    try {
        const user = await User.findOne({
            $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }]
        })
            .populate('themeId')
            .populate('choirId');

        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }

        if (!user.password) {
            res.status(500).json({ message: 'User data corrupted' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({ message: 'Invalid password' });
            return;
        }

        const normalizedUser = normalizeUserWithChoir(user);

        const choirIdString: string | undefined = normalizedUser.choirId;
        const choirName: string | undefined = normalizedUser.choirName;
        const choirCode: string | undefined = normalizedUser.choirCode;

        const accessToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                choirId: choirIdString,
                choirName
            },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            {
                id: user.id,
                username: user.username
            },
            JWT_REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        await RefreshToken.create({ token: refreshToken, userId: user._id });

        user.lastAccess = new Date();
        await user.save();

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            role: user.role,
            user: normalizedUser,
            choirId: choirIdString,
            choirCode
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
});


// REFRESH TOKEN
router.post(['/refresh', '/refresh-token'], async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.body.token || req.body.refreshToken;

    if (!refreshToken) {
        res.status(403).json({ message: 'Refresh Token required' });
        return;
    }

    try {
        const userPayload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;

        const storedToken = await RefreshToken.findOne({
            token: refreshToken,
            userId: userPayload.id
        });

        if (!storedToken) {
            res.status(403).json({ message: 'Refresh token invalid or revoked' });
            return;
        }

        const dbUser = await User.findById(userPayload.id);
        const currentRole = dbUser ? dbUser.role : 'VIEWER';
        const currentName = dbUser ? dbUser.name : undefined;
        const currentChoirId = dbUser?.choirId ? dbUser.choirId.toString() : undefined;

        const newAccessToken = jwt.sign(
            {
                id: userPayload.id as string,
                username: userPayload.username as string,
                role: currentRole,
                name: currentName,
                choirId: currentChoirId
            },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        res.json({ accessToken: newAccessToken });
    } catch (err: any) {
        res.status(403).json({ message: 'Token expired or invalid' });
    }
});

// LOGOUT
router.post('/logout', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const token = req.body.token || req.body.refreshToken;
        if (token) {
            await RefreshToken.deleteOne({ token });
        }

        res.json({ message: 'Logout successful' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
