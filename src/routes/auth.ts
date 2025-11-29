import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshUltraSeguro';

// 🟣 REGISTER (Public - Mobile App)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        // Destructure English fields directly
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
            role: 'VIEWER' // Default role
        });

        await newUser.save();
        
        // Generate Tokens
        const accessToken = jwt.sign(
            { id: newUser._id, username: newUser.username, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: newUser._id, username: newUser.username },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
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

// 🟣 LOGIN
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    // Mobile sends 'username' (can be email or username string)
    const usernameOrEmail = req.body.username || req.body.usernameOrEmail; 
    const { password } = req.body;

    try {
        const user = await User.findOne({
            $or: [
                { email: usernameOrEmail },
                { username: usernameOrEmail }
            ]
        }).populate('themeId'); // Populate English field 'themeId'

        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }

        // Password check (user.password is optional in interface, but required in DB schema)
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
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: user._id, username: user.username },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Clean up old tokens (optional) or just add new one
        await RefreshToken.create({ token: refreshToken, userId: user._id });

        user.lastAccess = new Date();
        await user.save();

        // Standardized English Response
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

// 🟣 REFRESH TOKEN
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.body.token || req.body.refreshToken;

    if(!refreshToken) {
        res.status(403).json({ message: 'Refresh Token required' });
        return;
    }

    const decoded = jwt.decode(refreshToken) as JwtPayload | null;
    // Note: decoded.id is correct if you signed it with 'id' above
    if (!decoded?.id) {
        res.status(403).json({ message: 'Invalid Token' });
        return;
    }

    const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: decoded.id
    });

    if (!storedToken) {
        res.status(403).json({ message: 'Refresh token not found in DB' });
        return;
    }

    try {
        const userPayload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;

        // Fetch user to get current role (in case it changed)
        const dbUser = await User.findById(userPayload.id);
        const currentRole = dbUser ? dbUser.role : 'VIEWER';

        const newAccessToken = jwt.sign(
            { id: userPayload.id, username: userPayload.username, role: currentRole },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(403).json({ message: 'Token expired or invalid' });
    }
});

// 🟣 LOGOUT
router.post('/logout', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const token = req.body.token || req.body.refreshToken;
        if(token) {
            await RefreshToken.deleteOne({ token });
        }
        
        res.json({ message: 'Logout successful' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;