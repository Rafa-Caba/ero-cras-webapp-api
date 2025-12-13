import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import { uploadUserImage } from '../middlewares/cloudinaryStorage';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import User from '../models/User';
import Choir from '../models/Choir';
import { registerLog } from '../utils/logger';
import { setCreatedBy } from '../utils/setCreatedBy';
import { normalizeUserWithChoir } from '../utils/normalizeUser';

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
            console.error('Error parsing JSON from mobile:', e);
        }
    }
    return body;
};

/**
 * Helper: Resolve choirId for list/search/directory queries
 */
const resolveChoirFilter = (req: RequestWithUser): { choirId?: string } => {
    const currentUser = req.user;
    const filter: { choirId?: string } = {};

    if (!currentUser) {
        return filter;
    }

    const queryChoirId = (req.query.choirId as string | undefined)?.toString();

    if (currentUser.role === 'SUPER_ADMIN') {
        if (queryChoirId) {
            filter.choirId = queryChoirId;
        } else if (currentUser.choirId) {
            filter.choirId = currentUser.choirId;
        }
    } else {
        if (currentUser.choirId) {
            filter.choirId = currentUser.choirId;
        }
    }

    return filter;
};

/**
 * Helper: Ensure current user can access a target user
 */
const ensureSameChoirOrSuperAdmin = (
    req: RequestWithUser,
    user: any
): string | null => {
    const currentUser = req.user;
    if (!currentUser) {
        return 'No autenticado';
    }

    if (currentUser.role === 'SUPER_ADMIN') {
        return null;
    }

    const currentChoirId = currentUser.choirId;
    const targetChoirId = user?.choirId?.toString();

    if (!currentChoirId || !targetChoirId || currentChoirId !== targetChoirId) {
        return 'No tienes permisos para acceder a este usuario';
    }

    return null;
};

// GET /me (Profile)
router.get(
    '/me',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;

            const user = await User.findById(userId)
                .populate('themeId')
                .populate('choirId');

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            const normalizedUser = normalizeUserWithChoir(user);

            res.json(normalizedUser);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// PUT /me/push-token
router.put(
    '/me/push-token',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            const { token } = req.body;

            await User.findByIdAndUpdate(userId, { $set: { pushToken: token } });

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// PUT /me/theme (Theme Switcher)
router.put(
    '/me/theme',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            const { themeId } = req.body;

            const user = await User.findByIdAndUpdate(
                userId,
                { themeId: themeId },
                { new: true }
            ).populate('themeId');

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            res.json(user.toJSON());
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// PUT /me (Update Profile - Hybrid)
router.put(
    '/me',
    verifyToken,
    uploadUserImage.single('file'),
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

            // 2. Update Fields
            if (body.name) user.name = body.name;
            if (body.username) user.username = body.username.toLowerCase();
            if (body.email) user.email = body.email;

            // 🎵 New instrument fields
            if (body.instrumentId !== undefined) {
                user.instrumentId = body.instrumentId || null;
            }
            if (body.instrumentLabel) {
                user.instrumentLabel = body.instrumentLabel;
            } else if (body.instrument) {
                // Backward compatibility
                user.instrumentLabel = body.instrument;
            }

            if (body.bio) user.bio = body.bio;

            if (body.voice !== undefined) {
                user.voice = body.voice === 'true' || body.voice === true;
            }

            // 3. Handle Password
            if (body.password) {
                user.password = await bcrypt.hash(body.password, 10);
            }

            const savedUser = await user.save();

            await savedUser.populate('themeId');
            await savedUser.populate('choirId');

            const normalizedUser = normalizeUserWithChoir(savedUser);

            res.json(normalizedUser);
        } catch (error: any) {
            console.error('Update Profile Error:', error);
            res.status(400).json({ message: error.message });
        }
    }
);

// --- ADMIN ROUTES BELOW ---

// GET /search
router.get(
    '/search',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        const query = req.query.q?.toString().trim();
        if (!query) {
            res.status(400).json({ message: 'Query is empty' });
            return;
        }

        try {
            const regex = new RegExp(query, 'i');
            const choirFilter = resolveChoirFilter(req);

            // If not SUPER_ADMIN and no choirId in token → deny
            if (!req.user) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }
            if (req.user.role !== 'SUPER_ADMIN' && !choirFilter.choirId) {
                res.status(400).json({
                    message: 'No se encontró coro asociado al usuario autenticado'
                });
                return;
            }

            const users = await User.find({
                ...choirFilter,
                $or: [{ name: regex }, { email: regex }, { username: regex }]
            });

            res.json(users.map(u => u.toJSON()));
        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({ message: 'Search error' });
        }
    }
);

// GET DIRECTORY
router.get(
    '/directory',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const choirFilter = resolveChoirFilter(req);

            if (!req.user) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }
            if (req.user.role !== 'SUPER_ADMIN' && !choirFilter.choirId) {
                res.status(400).json({
                    message: 'No se encontró coro asociado al usuario autenticado'
                });
                return;
            }

            const users = await User.find(choirFilter)
                .select('name username imageUrl role _id')
                .sort({ name: 1 });

            res.json(users.map(u => u.toJSON()));
        } catch (error) {
            console.error('Directory error:', error);
            res.status(500).json({ message: 'Error retrieving directory' });
        }
    }
);

// GET / (Paginated List)
router.get(
    '/',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const choirFilter = resolveChoirFilter(req);

            if (!req.user) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }
            if (req.user.role !== 'SUPER_ADMIN' && !choirFilter.choirId) {
                res.status(400).json({
                    message: 'No se encontró coro asociado al usuario autenticado'
                });
                return;
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            const [users, total] = await Promise.all([
                User.find(choirFilter)
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit),
                User.countDocuments(choirFilter)
            ]);

            res.json({
                users: users.map(u => u.toJSON()),
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ message: 'Error retrieving users' });
        }
    }
);

// GET /:id (Admin View)
router.get(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = await User.findById(req.params.id).select('-password');
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            const choirError = ensureSameChoirOrSuperAdmin(req, user);
            if (choirError) {
                res.status(403).json({ message: choirError });
                return;
            }

            res.json(user.toJSON());
        } catch (error: any) {
            console.error('Get user by id error:', error);
            res.status(500).json({ message: error.message });
        }
    }
);

// CREATE (Admin)
router.post(
    '/',
    verifyToken,
    uploadUserImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const currentUser = req.user;
            if (!currentUser) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }

            if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
                res.status(403).json({
                    message: 'No tienes permisos para crear usuarios'
                });
                return;
            }

            const body = parseBody(req);
            const {
                name,
                username,
                email,
                password,
                role,
                instrument,
                instrumentId,
                instrumentLabel,
                voice,
                bio,
                choirId: bodyChoirId
            } = body;

            if (!name || !username || !email || !password) {
                res.status(400).json({
                    message: 'Nombre, usuario, correo y contraseña son requeridos'
                });
                return;
            }

            // Determine target choir for the new user (align with multi-choir rules)
            let targetChoirId: string | null = null;

            if (currentUser.role === 'SUPER_ADMIN') {
                if (bodyChoirId) {
                    const choir = await Choir.findById(bodyChoirId);
                    if (!choir) {
                        res.status(400).json({ message: 'Coro inválido' });
                        return;
                    }
                    targetChoirId = choir.id.toString();
                } else if (currentUser.choirId) {
                    targetChoirId = currentUser.choirId;
                }
            } else {
                if (!currentUser.choirId) {
                    res.status(400).json({
                        message: 'No se encontró coro para el usuario autenticado'
                    });
                    return;
                }
                targetChoirId = currentUser.choirId;
            }

            if (!targetChoirId) {
                res.status(400).json({
                    message: 'No se ha podido determinar el coro para este usuario'
                });
                return;
            }

            // Uniqueness check per choir (username/email within same choir)
            const exists = await User.findOne({
                choirId: targetChoirId,
                $or: [
                    { username: username.toLowerCase() },
                    { email }
                ]
            });

            if (exists) {
                res.status(409).json({
                    message: 'User or email already exists in this choir'
                });
                return;
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const validRoles = [
                'ADMIN',
                'EDITOR',
                'VIEWER',
                'USER',
                'SUPER_ADMIN'
            ] as const;
            const requestedRole = (role as string) || 'VIEWER';

            let finalRole: (typeof validRoles)[number] = 'VIEWER';

            if (currentUser.role === 'SUPER_ADMIN') {
                if (validRoles.includes(requestedRole as any)) {
                    finalRole = requestedRole as any;
                }
            } else if (currentUser.role === 'ADMIN') {
                if (['EDITOR', 'VIEWER'].includes(requestedRole)) {
                    finalRole = requestedRole as any;
                } else {
                    finalRole = 'VIEWER';
                }
            }

            const newUser = new User({
                name,
                username: username.toLowerCase(),
                email,
                password: hashedPassword,
                role: finalRole,

                // 🎵 instrument fields
                instrumentId: instrumentId || null,
                instrumentLabel: instrumentLabel || instrument || '',

                voice: String(voice) === 'true' || voice === true,
                bio,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || '',
                choirId: targetChoirId,
                createdBy: (req.body as any).createdBy
            });

            await newUser.save();

            await registerLog({
                req: req as any,
                collection: 'Users',
                action: 'create',
                referenceId: newUser.id.toString(),
                changes: { new: newUser.toJSON() }
            });

            res.status(200).json({
                message: 'User created successfully',
                user: newUser.toJSON()
            });
        } catch (error: any) {
            console.error('Create user error:', error);
            res.status(400).json({ message: error.message });
        }
    }
);

// UPDATE (Admin)
router.put(
    '/:id',
    verifyToken,
    uploadUserImage.single('file'),
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const {
                name,
                username,
                email,
                password,
                role,
                instrument,
                instrumentId,
                instrumentLabel,
                voice,
                bio,
                choirId
            } = body;

            const user = await User.findById(req.params.id);

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            const choirError = ensureSameChoirOrSuperAdmin(req, user);
            if (choirError) {
                res.status(403).json({ message: choirError });
                return;
            }

            const currentUser = req.user;
            if (!currentUser) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }

            // Handle image upload
            if (req.file) {
                if (user.imagePublicId) {
                    await cloudinary.uploader.destroy(user.imagePublicId);
                }
                user.imageUrl = req.file.path;
                user.imagePublicId = req.file.filename;
            }

            // Determine new choirId (only SUPER_ADMIN can change it)
            let newChoirId: string | null | undefined = user.choirId?.toString();
            if (choirId !== undefined && currentUser.role === 'SUPER_ADMIN') {
                newChoirId = choirId || null;
                user.choirId = newChoirId as any;
            }

            // Prepare new username/email values (for uniqueness check)
            const newUsername = username
                ? username.toLowerCase()
                : user.username;
            const newEmail = email || user.email;

            // Uniqueness per choir if something relevant changed
            if (newChoirId) {
                const duplicate = await User.findOne({
                    _id: { $ne: user._id },
                    choirId: newChoirId,
                    $or: [
                        { username: newUsername },
                        { email: newEmail }
                    ]
                });

                if (duplicate) {
                    res.status(409).json({
                        message:
                            'Another user in this choir already uses that username or email'
                    });
                    return;
                }
            }

            // Apply basic field updates
            if (name) user.name = name;
            user.username = newUsername;
            user.email = newEmail;

            // Role changes:
            if (role && currentUser.role === 'SUPER_ADMIN') {
                user.role = role;
            }

            // 🎵 instrument fields
            if (instrumentId !== undefined) {
                user.instrumentId = instrumentId || null;
            }
            if (instrumentLabel) {
                user.instrumentLabel = instrumentLabel;
            } else if (instrument) {
                user.instrumentLabel = instrument;
            }

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
                updatedUser: user.toJSON()
            });
        } catch (error: any) {
            console.error('Update user error:', error);
            res.status(400).json({ message: error.message });
        }
    }
);

// DELETE
router.delete(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            const choirError = ensureSameChoirOrSuperAdmin(req, user);
            if (choirError) {
                res.status(403).json({ message: choirError });
                return;
            }

            if (user.imagePublicId) {
                await cloudinary.uploader.destroy(user.imagePublicId);
            }

            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User deleted successfully' });
        } catch (error: any) {
            console.error('Delete user error:', error);
            res.status(500).json({ message: error.message });
        }
    }
);

export default router;
