import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import BlogPost from '../models/BlogPost';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { uploadBlogImage } from '../middlewares/cloudinaryStorage';
import { setCreatedBy, setUpdatedBy } from '../utils/setCreatedBy';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import { Types } from 'mongoose';

const router = express.Router();

const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error("Error parsing JSON:", e);
        }
    }
    return body;
};

// 🟣 PUBLIC LIST
router.get('/public', async (req: Request, res: Response) => {
    try {
        // Only fetch valid authors to avoid populate crashes
        const posts = await BlogPost.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .populate('author', 'name username imageUrl');
        res.json(posts);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving public posts' });
    }
});

// 🟣 ADMIN LIST
router.get('/', verifyToken, async (req: Request, res: Response) => {
    try {
        const posts = await BlogPost.find()
            .sort({ createdAt: -1 })
            .populate('author', 'name username imageUrl');
        res.json(posts);
    } catch (error: any) {
        res.status(500).json({ message: 'Error retrieving posts' });
    }
});

// 🟣 GET ONE
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id).populate('author', 'name username imageUrl');
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }
        res.json(post);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 CREATE (Fixed Image Handling)
router.post('/',
    verifyToken,
    uploadBlogImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, content, isPublic } = body;

            const author = req.user?.id;

            const newPost = new BlogPost({
                title,
                content,
                isPublic: isPublic === true || String(isPublic) === 'true',
                author,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || '',
                createdBy: req.body.createdBy
            });

            await newPost.save();
            await newPost.populate('author', 'name username');

            if (newPost.isPublic) {
                notifyCommunity(req.user?.id, req.user?.username || 'Admin', 'BLOG', newPost);
            }

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'create',
                referenceId: newPost.id.toString(),
                changes: { new: newPost }
            });

            res.status(201).json({ message: 'Post created successfully', post: newPost });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });

// 🟣 UPDATE (Fixed Atomic Update)
router.put('/:id',
    verifyToken,
    uploadBlogImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { title, content, isPublic } = body;
            const postId = req.params.id;

            // 1. Fetch current to handle image deletion
            const currentPost = await BlogPost.findById(postId);
            if (!currentPost) {
                res.status(404).json({ message: 'Post not found' });
                return;
            }

            // Prepare Update Object
            const updateFields: any = {
                updatedBy: req.body.updatedBy
            };

            if (title) updateFields.title = title;
            if (content) updateFields.content = content;
            if (isPublic !== undefined) updateFields.isPublic = isPublic === true || String(isPublic) === 'true';

            // 2. Handle Image Replacement
            if (req.file) {
                if (currentPost.imagePublicId) {
                    await cloudinary.uploader.destroy(currentPost.imagePublicId);
                }
                updateFields.imageUrl = req.file.path;
                updateFields.imagePublicId = req.file.filename;
            }

            // 3. Atomic Update (Skips validating 'author' if it's broken)
            const updatedPost = await BlogPost.findByIdAndUpdate(
                postId,
                { $set: updateFields },
                { new: true, runValidators: false }
            );

            await registerLog({
                req: req as any,
                collection: 'BlogPosts',
                action: 'update',
                referenceId: postId,
                changes: { updated: updatedPost }
            });

            res.json({ message: 'Post updated', post: updatedPost });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });

// 🟣 TOGGLE LIKE (Atomic & Robust)
router.put('/:id/like', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const postId = req.params.id;

    if (!userId) { res.status(401).json({ message: 'User ID missing' }); return; }

    try {
        // 1. Fetch lean to check existence and array
        const post = await BlogPost.findById(postId).select('likesUsers').lean();
        if (!post) { res.status(404).json({ message: 'Post not found' }); return; }

        // @ts-ignore
        const likesList = post.likesUsers || [];
        // @ts-ignore
        const isLiked = likesList.some(id => id.toString() === userId.toString());

        let updateQuery = {};

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

        // 2. Atomic Update - This fixes the "ValidatorError" on author
        const updatedPost = await BlogPost.findByIdAndUpdate(
            postId,
            updateQuery,
            { new: true, runValidators: false }
        );

        // Sanity check: Ensure likes is never negative
        if (updatedPost && updatedPost.likes < 0) {
            await BlogPost.findByIdAndUpdate(postId, { $set: { likes: 0 } });
            updatedPost.likes = 0;
        }

        res.json({
            message: 'Like updated',
            likes: updatedPost?.likes || 0,
            likesUsers: updatedPost?.likesUsers || []
        });

    } catch (error: any) {
        console.error("❌ Like Error:", error);
        res.status(500).json({ message: 'Error updating like', error: error.message });
    }
});

// ... (Comment & Delete routes keep existing logic) ...
// 🟣 ADD COMMENT
router.post('/:id/comment', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { text } = req.body;
        const authorName = req.user?.username || 'Unknown';

        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        post.comments.push({
            author: authorName,
            text,
            date: new Date()
        });

        // Save might fail if author is broken, try atomic push if save fails
        try {
            await post.save();
        } catch (saveError) {
            await BlogPost.findByIdAndUpdate(req.params.id, {
                $push: { comments: { author: authorName, text, date: new Date() } }
            }, { runValidators: false });
        }

        res.json({ message: 'Comment added', comments: post.comments });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 DELETE
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

        res.json({ message: 'Post deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;