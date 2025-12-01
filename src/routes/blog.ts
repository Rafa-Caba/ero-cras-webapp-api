import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { uploadBlogImage } from '../middlewares/cloudinaryStorage';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import BlogPost from '../models/BlogPost';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAuthors, applyPopulateSingleAuthor } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';

const router = express.Router();

/**
 * Helper: Parse Request Body (Mobile vs Web)
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

// 🟣 CREATE POST
router.post('/',
    verifyToken,
    uploadBlogImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);

            const { title, content } = body;

            // Handle Boolean / Defaults
            const isPublic = body.isPublic === true || body.isPublic === 'true';

            // Default author to username if not provided
            const author = body.author || req.user?.username || 'Admin';

            if (!content) {
                res.status(400).json({ message: 'Content is required' });
                return;
            }

            const newPost = new BlogPost({
                title,
                content, // TipTap JSON
                author,
                isPublic,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || '',
                createdBy: req.body.createdBy
            });

            await newPost.save();

            if (newPost.isPublic) {
                notifyCommunity(
                    req.user?.id,
                    newPost.author || 'Autor',
                    'BLOG',
                    newPost
                );
            }

            if (!newPost._id) return;

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'create',
                referenceId: newPost._id.toString(),
                changes: { new: newPost }
            });

            const populated = await BlogPost.findById(newPost._id).populate('createdBy', 'name username imageUrl');

            res.status(201).json(populated);
        } catch (error: any) {
            console.error("Create Blog Error:", error);
            res.status(400).json({ message: error.message });
        }
    });

// 🟣 UPDATE POST
router.put('/:id',
    verifyToken,
    uploadBlogImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, content, author, isPublic } = body;

            const post = await BlogPost.findById(req.params.id);
            if (!post) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }

            // Handle Image Replacement
            if (req.file) {
                if (post.imagePublicId) {
                    await cloudinary.uploader.destroy(post.imagePublicId);
                }
                post.imageUrl = req.file.path;
                post.imagePublicId = req.file.filename;
            }

            if (title) post.title = title;
            if (content) post.content = content;
            if (author) post.author = author;
            if (isPublic !== undefined) post.isPublic = isPublic === 'true' || isPublic === true;

            post.updatedBy = req.body.updatedBy;

            await post.save();

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'update',
                referenceId: post.id.toString(),
                changes: { updated: post }
            });

            const populated = await BlogPost.findById(post._id).populate('createdBy', 'name username imageUrl');
            res.json(populated);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    });

// GET All Public
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const posts = await BlogPost.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name username imageUrl');
        res.json(posts);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// GET All (Admin)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const posts = await applyPopulateAuthors(BlogPost.find().sort({ createdAt: -1 }));
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving posts' });
    }
});

// GET By ID
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await applyPopulateSingleAuthor(BlogPost.findById(req.params.id));
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }
        res.json(post);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        if (post.imagePublicId) {
            await cloudinary.uploader.destroy(post.imagePublicId);
        }

        await BlogPost.findByIdAndDelete(req.params.id);

        await registerLog({
            req: req as any,
            collection: 'BlogPosts',
            action: 'delete',
            referenceId: post.id.toString(),
            changes: { deleted: post }
        });

        res.json({ message: 'Post deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// LIKE
router.post('/:id/like', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) { res.status(404).json({ message: 'Post not found' }); return; }

        const userId = req.user?.id || req.body.userId;
        if (!userId) { res.status(400).json({ message: 'User ID missing' }); return; }

        const hasLiked = post.likesUsers.includes(userId);

        if (hasLiked) {
            post.likesUsers = post.likesUsers.filter(id => id !== userId);
        } else {
            post.likesUsers.push(userId);
        }

        post.likes = post.likesUsers.length;
        await post.save();

        res.json(post);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// COMMENT
router.post('/:id/comments', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) { res.status(404).json({ message: 'Post not found' }); return; }

        const { author, text } = req.body;

        // Handle Simple text -> TipTap JSON conversion
        let content = text;
        if (typeof text === 'string') {
            content = {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }]
            };
        }

        if (!author || !content) { res.status(400).json({ message: 'Missing data' }); return; }

        post.comments.unshift({ author, text: content, date: new Date() });
        await post.save();

        res.json(post);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

export default router;