import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary'; 
import { uploadUserImage } from '../middlewares/cloudinaryStorage'; 
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import { registerLog } from '../utils/logger';

const router = express.Router();

/**
 * Helper: Parse Request Body
 */
const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error("Error parsing JSON from mobile:", e);
        }
    }
    return body;
};

// 🟣 GET /me (Profile)
router.get('/me', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        
        // Populate themeId (reference to Theme model)
        // Using 'themeId' field from our English User model
        const user = await User.findById(userId).populate('themeId');
        
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 PUT /me/push-token
router.put('/me/push-token', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { token } = req.body; 
        
        await User.findByIdAndUpdate(userId, { $set: { pushToken: token } });
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 PUT /me/theme (Theme Switcher)
router.put('/me/theme', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { themeId } = req.body; 

        const user = await User.findByIdAndUpdate(
            userId, 
            { themeId: themeId },
            { new: true }
        ).populate('themeId');

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 PUT /me (Update Profile - Hybrid)
router.put('/me', 
    verifyToken, 
    uploadUserImage.single('file'), // Standard field 'file'
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const body = parseBody(req); 
        
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // 1. Handle Image Upload
        if (req.file) {
            if (user.imagePublicId) {
                await cloudinary.uploader.destroy(user.imagePublicId);
            }
            user.imageUrl = req.file.path;
            user.imagePublicId = req.file.filename;
        }

        // 2. Update Fields (Strict English keys)
        if (body.name) user.name = body.name;
        if (body.username) user.username = body.username.toLowerCase();
        if (body.email) user.email = body.email;
        
        if (body.instrument) user.instrument = body.instrument;
        if (body.bio) user.bio = body.bio;
        
        // Handle Boolean
        if (body.voice !== undefined) {
            user.voice = body.voice === 'true' || body.voice === true;
        }

        // 3. Handle Password
        if (body.password) {
            user.password = await bcrypt.hash(body.password, 10);
        }

        await user.save();
        await user.populate('themeId');
        
        res.json(user);
    } catch (error: any) {
        console.error("Update Profile Error:", error);
        res.status(400).json({ message: error.message });
    }
});

// --- ADMIN ROUTES BELOW ---

// GET /search
router.get('/search', verifyToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();
    if (!query) {
        res.status(400).json({ message: 'Query is empty' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const users = await User.find({
            $or: [
                { name: regex },
                { email: regex },
                { username: regex }
            ]
        }); 

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Search error' });
    }
});

// 🟣 GET DIRECTORY (Public/Protected - Minimal Info for Chat)
router.get('/directory', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        // Fetch only necessary fields
        const users = await User.find()
            .select('name username imageUrl role _id')
            .sort({ name: 1 });
            
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving directory' });
    }
});

// GET / (Paginated List)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find()
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments()
        ]);

        // Return standardized English response
        res.json({
            users,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsers: total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving users' });
    }
});

// GET /:id (Admin View)
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id).select('-password'); 
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 CREATE (Admin)
router.post('/', uploadUserImage.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        const { name, username, email, password, role, instrument, voice, bio } = body;

        const exists = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email }]
        });

        if (exists) {
            res.status(409).json({ message: 'User or email already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username: username.toLowerCase(),
            email,
            password: hashedPassword,
            role,
            instrument,
            // Handle boolean string from FormData
            voice: String(voice) === 'true' || voice === true,
            bio,
            imageUrl: req.file?.path || '',
            imagePublicId: req.file?.filename || ''
        });

        await newUser.save();

        res.status(200).json({
            message: 'User created successfully',
            user: newUser
        });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

// 🟣 UPDATE (Admin)
router.put('/:id', verifyToken, uploadUserImage.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        const { name, username, email, password, role, instrument, voice, bio } = body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
             res.status(404).json({ message: 'User not found' });
             return;
        }

        if (req.file) {
            if (user.imagePublicId) {
                await cloudinary.uploader.destroy(user.imagePublicId);
            }
            user.imageUrl = req.file.path;
            user.imagePublicId = req.file.filename;
        }

        if (name) user.name = name;
        if (username) user.username = username;
        if (email) user.email = email;
        if (role) user.role = role;
        if (instrument) user.instrument = instrument;
        if (bio) user.bio = bio;
        
        if (voice !== undefined) {
            user.voice = String(voice) === 'true' || voice === true;
        }

        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        res.json({
            message: 'User updated successfully',
            updatedUser: user
        });

    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE
router.delete('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (user.imagePublicId) {
            await cloudinary.uploader.destroy(user.imagePublicId);
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;