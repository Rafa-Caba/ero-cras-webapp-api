// src/controllers/blog.controller.ts

import type { Request, Response } from 'express';
import { deleteFromCloudinary } from '../middlewares/cloudinaryStorage';
import BlogPost, { type IBlogPost } from '../models/BlogPost';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import { resolvePublicChoirId } from '../services/publicChoir.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import { parseBlogInput } from '../validations/schemas/resource.schemas';
import {
    parseObjectId,
    parseRequestBody,
    readRequiredContent
} from '../validations/schemas/common.schemas';

interface ResourceParams {
    readonly id: string;
    readonly choirKey?: string;
}

const findPost = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IBlogPost> => {
    return BlogPost
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() =>
            createTenantResourceNotFoundError(
                'BLOG_POST_NOT_FOUND',
                'Blog post not found'
            )
        )
        .exec();
};

export const listPublicBlogController = async (
    req: Request<ResourceParams>,
    res: Response
): Promise<void> => {
    const choirId = await resolvePublicChoirId(req);
    const posts = await BlogPost.find({ choirId, isPublic: true })
        .select('-imagePublicId -updatedBy')
        .populate('author', 'name username imageUrl')
        .sort({ createdAt: -1 });
    res.json(posts);
};

export const listBlogController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const posts = await BlogPost.find({
        choirId: requireEffectiveChoirObjectId(req)
    })
        .populate('author', 'name username imageUrl')
        .sort({ createdAt: -1 });
    res.json(posts);
};

export const getBlogPostController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const post = await findPost(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    await post.populate('author', 'name username imageUrl');
    res.json(post);
};

export const createBlogPostController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const actorUserId = requireAuthenticatedUserId(req);
    const input = parseBlogInput(req);
    const post = await BlogPost.create({
        ...input,
        imageUrl: req.file?.path ?? '',
        imagePublicId: req.file?.filename ?? null,
        author: actorUserId,
        choirId: requireEffectiveChoirObjectId(req),
        likes: 0,
        likesUsers: [],
        comments: [],
        createdBy: actorUserId
    });

    await registerLog({
        req,
        collection: 'BlogPosts',
        action: 'create',
        referenceId: post.id,
        changes: { after: post.toObject() }
    });

    if (post.isPublic) {
        await notifyCommunity(
            requireEffectiveChoirId(req),
            req.user?.id,
            req.user?.name ?? '',
            'BLOG',
            post
        );
    }

    res.status(201).json(post);
};

export const updateBlogPostController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const post = await findPost(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = post.toObject();
    const input = parseBlogInput(req);

    if (req.file) {
        await deleteFromCloudinary(post.imagePublicId ?? '');
        post.imageUrl = req.file.path;
        post.imagePublicId = req.file.filename;
    }

    post.title = input.title;
    post.content = input.content;
    post.isPublic = input.isPublic;
    post.updatedBy = requireAuthenticatedUserId(req);
    await post.save();

    await registerLog({
        req,
        collection: 'BlogPosts',
        action: 'update',
        referenceId: post.id,
        changes: { before, after: post.toObject() }
    });

    res.json(post);
};

export const toggleBlogLikeController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const post = await findPost(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const userId = requireAuthenticatedUserId(req);
    const existingIndex = post.likesUsers.findIndex((item) => item.equals(userId));
    const action = existingIndex >= 0 ? 'remove_reaction' : 'add_reaction';

    if (existingIndex >= 0) {
        post.likesUsers.splice(existingIndex, 1);
    } else {
        post.likesUsers.push(userId);
    }

    post.likes = post.likesUsers.length;
    await post.save();

    await registerLog({
        req,
        collection: 'BlogPosts',
        action,
        referenceId: post.id,
        changes: { likes: post.likes }
    });

    res.json({ likes: post.likes, liked: existingIndex < 0 });
};

export const addBlogCommentController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const post = await findPost(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const text = readRequiredContent(parseRequestBody(req), 'text');
    post.comments.push({
        author: req.user?.username ?? req.user?.name ?? 'User',
        text,
        date: new Date()
    });
    await post.save();
    res.status(201).json(post.comments[post.comments.length - 1]);
};

export const deleteBlogPostController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const post = await findPost(
        req.params.id,
        requireEffectiveChoirObjectId(req)
    );
    const before = post.toObject();
    await deleteFromCloudinary(post.imagePublicId ?? '');
    await post.deleteOne();

    await registerLog({
        req,
        collection: 'BlogPosts',
        action: 'delete',
        referenceId: post.id,
        changes: { before }
    });

    res.json({ message: 'Blog post deleted successfully' });
};
