import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { Types } from 'mongoose';

import BlogPost from '../models/BlogPost';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { uploadBlogImage } from '../middlewares/cloudinaryStorage';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';

const router = express.Router();

const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    }
    return body;
};

/**
 * Helper: Resolve choirId from a "key" that can be
 * - ObjectId string
 * - choir code
 * - choir name (fallback)
 */
const resolveChoirIdFromKey = async (choirKey?: string | null): Promise<string | null> => {
    if (!choirKey) return null;

    if (Types.ObjectId.isValid(choirKey)) {
        return choirKey;
    }

    const choir = await Choir.findOne({
        $or: [{ code: choirKey }, { name: choirKey }]
    }).select('_id');

    return choir ? choir.id.toString() : null;
};

/**
 * Helper: Build public filter for blog posts
 */
const buildPublicFilter = async (req: Request): Promise<any> => {
    const { choirId } = req.query;
    const choirKeyParam = (req.params as any).choirKey as string | undefined;

    const filter: any = { isPublic: true };

    const resolvedChoirId =
        (choirId && typeof choirId === 'string')
            ? choirId
            : (choirKeyParam ? await resolveChoirIdFromKey(choirKeyParam) : null);

    if (resolvedChoirId) {
        filter.choirId = resolvedChoirId;
    }

    return filter;
};

// PUBLIC LIST (base: /public)
router.get('/public', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const posts = await BlogPost.find(filter)
            .sort({ createdAt: -1 })
            .populate('author', 'name username imageUrl');

        res.json(posts.map(p => p.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public posts' });
    }
});

// PUBLIC LIST with choir key in URL: /public/:choirKey
router.get('/public/:choirKey', async (req: Request, res: Response) => {
    try {
        const filter = await buildPublicFilter(req);

        const posts = await BlogPost.find(filter)
            .sort({ createdAt: -1 })
            .populate('author', 'name username imageUrl');

        res.json(posts.map(p => p.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public posts' });
    }
});

// 🔐 ADMIN LIST (choir-scoped)
router.get('/', verifyToken, async (req: RequestWithUser, res: Response) => {
    try {
        const user = req.user;
        const query: any = {};

        // Non-SUPER_ADMIN only sees their choir
        if (user?.role !== 'SUPER_ADMIN') {
            if (user?.choirId) {
                query.choirId = user.choirId;
            }
        } else if (req.query.choirId) {
            query.choirId = req.query.choirId;
        }

        const posts = await BlogPost.find(query)
            .sort({ createdAt: -1 })
            .populate('author', 'name username imageUrl');

        res.json(posts.map(p => p.toJSON()));
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving posts' });
    }
});

// GET ONE (choir-scoped)
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const post = await BlogPost.findById(req.params.id)
            .populate('author', 'name username imageUrl');

        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        // Choir scoping for non-SUPER_ADMIN
        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && post.choirId) {
            if (post.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }
        }

        res.json(post.toJSON());
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// CREATE
router.post(
    '/',
    verifyToken,
    uploadBlogImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, content, isPublic } = body;

            if (!title || !content) {
                res.status(400).json({ message: 'Title and Content are required' });
                return;
            }

            const author = req.user?.id;
            const choirId = req.user?.choirId || null;

            const newPost = new BlogPost({
                title,
                content,
                isPublic: isPublic === true || String(isPublic) === 'true',
                author,
                choirId,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || '',
                createdBy: req.body.createdBy
            });

            await newPost.save();
            await newPost.populate('author', 'name username imageUrl');

            if (newPost.isPublic) {
                notifyCommunity(
                    req.user?.id,
                    req.user?.username || 'Admin',
                    'BLOG',
                    newPost
                );
            }

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'create',
                referenceId: newPost.id.toString(),
                changes: { new: newPost.toJSON() }
            });

            res.status(201).json({
                message: 'Post created successfully',
                post: newPost.toJSON()
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// UPDATE
router.put(
    '/:id',
    verifyToken,
    uploadBlogImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, content, isPublic } = body;
            const postId = req.params.id;
            const user = req.user;

            // 1. Fetch current to handle image + choir scoping
            const currentPost = await BlogPost.findById(postId);
            if (!currentPost) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }

            if (user?.role !== 'SUPER_ADMIN' && user?.choirId && currentPost.choirId) {
                if (currentPost.choirId.toString() !== user.choirId.toString()) {
                    res.status(404).json({ message: 'Post not found' });
                    return;
                }
            }

            // Prepare Update Object
            const updateFields: any = {
                updatedBy: req.body.updatedBy
            };

            if (title) updateFields.title = title;
            if (content) updateFields.content = content;
            if (isPublic !== undefined) {
                updateFields.isPublic = isPublic === true || String(isPublic) === 'true';
            }

            // 2. Handle Image Replacement
            if (req.file) {
                if (currentPost.imagePublicId) {
                    await cloudinary.uploader.destroy(currentPost.imagePublicId);
                }
                updateFields.imageUrl = req.file.path;
                updateFields.imagePublicId = req.file.filename;
            }

            // 3. Atomic Update
            const updatedPost = await BlogPost.findByIdAndUpdate(
                postId,
                { $set: updateFields },
                { new: true, runValidators: false }
            ).populate('author', 'name username imageUrl');

            if (!updatedPost) {
                res.status(404).json({ message: 'Post not found after update' });
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'update',
                referenceId: postId,
                changes: { updated: updatedPost.toJSON() }
            });

            res.json({ message: 'Post updated', post: updatedPost.toJSON() });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// TOGGLE LIKE (choir-safe)
router.put('/:id/like', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const postId = req.params.id;
    const user = req.user;

    if (!userId) {
        res.status(401).json({ message: 'User ID missing' });
        return;
    }

    try {
        // 1. Fetch lean to check existence, choir, and likes list
        const postDoc = await BlogPost.findById(postId).select('likesUsers choirId likes').lean();
        if (!postDoc) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && postDoc.choirId) {
            if (postDoc.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }
        }

        // @ts-ignore
        const likesList = postDoc.likesUsers || [];
        // @ts-ignore
        const isLiked = likesList.some((id: any) => id.toString() === userId.toString());

        let updateQuery: any = {};

        if (isLiked) {
            // UNLIKE
            updateQuery = {
                $pull: { likesUsers: new Types.ObjectId(userId) },
                $inc: { likes: -1 }
            };
        } else {
            // LIKE
            updateQuery = {
                $addToSet: { likesUsers: new Types.ObjectId(userId) },
                $inc: { likes: 1 }
            };
        }

        const updatedPost = await BlogPost.findByIdAndUpdate(
            postId,
            updateQuery,
            { new: true, runValidators: false }
        ).select('likes likesUsers');

        if (!updatedPost) {
            res.status(404).json({ message: 'Post not found after like update' });
            return;
        }

        // Sanity check: Ensure likes is never negative
        if (updatedPost.likes < 0) {
            updatedPost.likes = 0;
            await BlogPost.findByIdAndUpdate(postId, { $set: { likes: 0 } });
        }

        res.json({
            message: 'Like updated',
            likes: updatedPost.likes,
            likesUsers: updatedPost.likesUsers
        });
    } catch (error: any) {
        console.error('❌ Like Error:', error);
        res.status(500).json({ message: 'Error updating like', error: error.message });
    }
});

// ADD COMMENT (choir-safe)
router.post('/:id/comment', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { text } = req.body;
        const authorName = req.user?.username || 'Unknown';
        const user = req.user;

        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && post.choirId) {
            if (post.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }
        }

        post.comments.push({
            author: authorName,
            text,
            date: new Date()
        });

        try {
            await post.save();
        } catch (saveError) {
            await BlogPost.findByIdAndUpdate(
                req.params.id,
                { $push: { comments: { author: authorName, text, date: new Date() } } },
                { runValidators: false }
            );
        }

        res.json({ message: 'Comment added', comments: post.comments });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE (choir-safe)
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        if (user?.role !== 'SUPER_ADMIN' && user?.choirId && post.choirId) {
            if (post.choirId.toString() !== user.choirId.toString()) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }
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
            changes: { deleted: post.toJSON() }
        });

        res.json({ message: 'Post deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
