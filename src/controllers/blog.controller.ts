// src/controllers/blog.controller.ts

import type { Response } from 'express';
import { Types } from 'mongoose';
import BlogPost, { type IBlogPost } from '../models/BlogPost';
import {
    attachMediaAsset,
    deleteOwnedMedia,
    discardPendingMedia,
    uploadTenantMedia
} from '../services/media.service';
import { sendCacheableJson } from '../services/httpCache.service';
import {
    buildTenantResourceFilter,
    createTenantResourceNotFoundError,
    requireAuthenticatedUserId,
    requireEffectiveChoirId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { registerLog } from '../utils/logger';
import { notifyCommunity } from '../utils/notificationHelper';
import {
    parseObjectId,
    parseRequestBody,
    readRequiredContent
} from '../validations/schemas/common.schemas';
import { parseBlogInput } from '../validations/schemas/resource.schemas';

interface ResourceParams {
    readonly id: string;
}

const findPost = async (
    id: string,
    choirId: ReturnType<typeof parseObjectId>
): Promise<IBlogPost> => {
    return BlogPost
        .findOne(buildTenantResourceFilter(id, choirId))
        .orFail(() => createTenantResourceNotFoundError(
            'BLOG_POST_NOT_FOUND',
            'Blog post not found'
        ))
        .exec();
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

    sendCacheableJson(req, res, posts);
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
    const input = parseBlogInput(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const choirId = requireEffectiveChoirObjectId(req);
    const postId = new Types.ObjectId();
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'BLOG',
            category: 'blog'
        })
        : null;

    const post = await BlogPost.create({
        _id: postId,
        ...input,
        imageUrl: uploaded?.media.url ?? '',
        imagePublicId: uploaded?.media.publicId ?? null,
        imageResourceType: uploaded?.media.resourceType ?? null,
        imageAssetId: uploaded?.asset._id ?? null,
        author: actorUserId,
        choirId,
        likes: 0,
        likesUsers: [],
        comments: [],
        createdBy: actorUserId
    }).catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Blog post creation failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'BLOG', post._id);
    }

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

    await post.populate('author', 'name username imageUrl');
    res.status(201).json(post);
};

export const updateBlogPostController = async (
    req: RequestWithUser & { params: ResourceParams },
    res: Response
): Promise<void> => {
    const choirId = requireEffectiveChoirObjectId(req);
    const actorUserId = requireAuthenticatedUserId(req);
    const post = await findPost(req.params.id, choirId);
    const before = post.toObject();
    const input = parseBlogInput(req);
    const previousAssetId = post.imageAssetId;
    const uploaded = req.file
        ? await uploadTenantMedia({
            file: req.file,
            choirId,
            actorUserId,
            ownerType: 'BLOG',
            category: 'blog'
        })
        : null;

    post.title = input.title;
    post.content = input.content;
    post.isPublic = input.isPublic;
    post.updatedBy = actorUserId;

    if (uploaded) {
        post.imageUrl = uploaded.media.url;
        post.imagePublicId = uploaded.media.publicId;
        post.imageResourceType = uploaded.media.resourceType;
        post.imageAssetId = uploaded.asset._id;
    }

    await post.save().catch(async (error: Error) => {
        if (uploaded) {
            await discardPendingMedia(
                uploaded.asset._id,
                choirId,
                'Blog post update failed'
            );
        }
        throw error;
    });

    if (uploaded) {
        await attachMediaAsset(uploaded.asset._id, choirId, 'BLOG', post._id);
        await deleteOwnedMedia({
            assetId: previousAssetId,
            choirId,
            ownerType: 'BLOG',
            ownerId: post._id
        });
    }

    await registerLog({
        req,
        collection: 'BlogPosts',
        action: 'update',
        referenceId: post.id,
        changes: { before, after: post.toObject() }
    });

    await post.populate('author', 'name username imageUrl');
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
    const choirId = requireEffectiveChoirObjectId(req);
    const post = await findPost(req.params.id, choirId);
    const before = post.toObject();
    const assetId = post.imageAssetId;
    await post.deleteOne();
    await deleteOwnedMedia({
        assetId,
        choirId,
        ownerType: 'BLOG',
        ownerId: post._id
    });

    await registerLog({
        req,
        collection: 'BlogPosts',
        action: 'delete',
        referenceId: post.id,
        changes: { before }
    });

    res.json({ message: 'Blog post deleted successfully' });
};
