import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshUltraSeguro';

console.log({ JWT_SECRET, JWT_REFRESH_SECRET });

const ACCESS_TOKEN_EXPIRY = '1d';
const REFRESH_TOKEN_EXPIRY = '7d';

// REGISTER (Public - Mobile App)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, username, email, password, instrument } = req.body;

        if (!username || !email || !password) {
            res.status(400).json({ message: 'Missing required fields' });
            return;
        }

        const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email }]
        });

        if (existingUser) {
            res.status(409).json({ message: 'User or email already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username: username.toLowerCase(),
            email,
            password: hashedPassword,
            instrument: instrument || '',
            role: 'VIEWER'
        });

        await newUser.save();

        const accessToken = jwt.sign(
            { id: newUser._id, username: newUser.username, role: newUser.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { id: newUser._id, username: newUser.username },
            JWT_REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );

        await RefreshToken.create({ token: refreshToken, userId: newUser._id });

        res.status(201).json({
            accessToken,
            refreshToken,
            role: newUser.role,
            user: newUser.toJSON()
        });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// LOGIN
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const usernameOrEmail = req.body.username || req.body.usernameOrEmail;
    const { password } = req.body;

    console.log({ usernameOrEmail, password });
    console.log({ JWT_SECRET, JWT_REFRESH_SECRET });

    try {
        const user = await User.findOne({
            $or: [
                { email: usernameOrEmail },
                { username: usernameOrEmail }
            ]
        }).populate('themeId');

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

        const accessToken = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { id: user._id, username: user.username },
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
            user: user.toJSON()
        });
    } catch (error: any) {
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

        const newAccessToken = jwt.sign(
            { id: userPayload.id, username: userPayload.username, role: currentRole },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );

        res.json({ accessToken: newAccessToken });
    } catch (err) {
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