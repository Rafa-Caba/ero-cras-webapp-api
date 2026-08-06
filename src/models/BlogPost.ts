// src/models/BlogPost.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation, assertSameChoirRelations } from '../services/tenantRelation.service';
import type { StoredJsonValue } from '../types/content.types';
import type { MediaResourceType } from '../types/media.types';
import User from './User';

export interface BlogComment {
    _id?: Types.ObjectId;
    author: string;
    authorUserId?: Types.ObjectId | null;
    text: StoredJsonValue;
    date: Date;
}

export interface IBlogPost extends Document<Types.ObjectId> {
    title: string;
    content: StoredJsonValue;
    imageUrl?: string;
    imagePublicId?: string | null;
    imageResourceType?: MediaResourceType | null;
    imageAssetId?: Types.ObjectId | null;
    isPublic: boolean;
    author: Types.ObjectId;
    choirId: Types.ObjectId;
    likes: number;
    likesUsers: Types.ObjectId[];
    comments: BlogComment[];
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
    {
        title: { type: String, required: true, trim: true },
        content: { type: Schema.Types.Mixed, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },
        imageResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        imageAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
        isPublic: { type: Boolean, default: false },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        likes: { type: Number, default: 0, min: 0 },
        likesUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [
            {
                author: { type: String, required: true, trim: true },
                authorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
                text: { type: Schema.Types.Mixed, required: true },
                date: { type: Date, default: Date.now }
            }
        ],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

BlogPostSchema.pre('validate', async function validateTenantRelations(this: IBlogPost): Promise<void> {
    await assertSameChoirRelation(User, this.author, this.choirId, 'author');
    await assertSameChoirRelations(User, this.likesUsers, this.choirId, 'likesUsers');
    await assertSameChoirRelations(
        User,
        this.comments
            .map((comment) => comment.authorUserId)
            .filter((authorUserId): authorUserId is Types.ObjectId => Boolean(authorUserId)),
        this.choirId,
        'comments.authorUserId'
    );
});

BlogPostSchema.index({ choirId: 1, createdAt: -1 });
BlogPostSchema.index({ choirId: 1, isPublic: 1, createdAt: -1 });

const BlogPost = model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;
