// src/models/ChatMessage.ts

import { Document, Schema, Types, model } from 'mongoose';
import {
    assertSameChoirRelation,
    assertSameChoirRelations
} from '../services/tenantRelation.service';
import type { StoredJsonValue } from '../types/content.types';
import type { MediaResourceType } from '../types/media.types';
import User from './User';

export type MessageType =
    | 'TEXT'
    | 'IMAGE'
    | 'FILE'
    | 'MEDIA'
    | 'REACTION'
    | 'AUDIO'
    | 'VIDEO'
    | 'STICKER';

export interface ChatReaction {
    emoji: string;
    user: Types.ObjectId;
}

export interface IChatMessage extends Document<Types.ObjectId> {
    author: Types.ObjectId;
    choirId: Types.ObjectId;
    content: StoredJsonValue;
    type: MessageType;
    fileUrl?: string;
    filename?: string;
    imageUrl?: string;
    audioUrl?: string;
    mediaPublicId?: string;
    mediaResourceType?: MediaResourceType | null;
    mediaAssetId?: Types.ObjectId | null;
    reactions: ChatReaction[];
    replyTo?: Types.ObjectId | null;
    deliveredTo: Types.ObjectId[];
    readBy: Types.ObjectId[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        content: { type: Schema.Types.Mixed, required: true },
        type: {
            type: String,
            enum: ['TEXT', 'IMAGE', 'FILE', 'MEDIA', 'REACTION', 'AUDIO', 'VIDEO', 'STICKER'],
            required: true
        },
        fileUrl: { type: String, default: '' },
        filename: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        audioUrl: { type: String, default: '' },
        mediaPublicId: { type: String, default: '' },
        mediaResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        mediaAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
        reactions: [
            {
                emoji: { type: String, required: true },
                user: { type: Schema.Types.ObjectId, ref: 'User', required: true }
            }
        ],
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: 'ChatMessage',
            default: null
        },
        deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

ChatMessageSchema.pre('validate', async function validateTenantRelations(this: IChatMessage): Promise<void> {
    await assertSameChoirRelation(User, this.author, this.choirId, 'author');
    await assertSameChoirRelation(User, this.createdBy, this.choirId, 'createdBy');
    await assertSameChoirRelations(
        User,
        this.reactions.map((reaction) => reaction.user),
        this.choirId,
        'reactions.user'
    );
    await assertSameChoirRelations(User, this.deliveredTo, this.choirId, 'deliveredTo');
    await assertSameChoirRelations(User, this.readBy, this.choirId, 'readBy');

    if (!this.replyTo) {
        return;
    }

    const ChatMessageModel = model<IChatMessage>('ChatMessage');
    await assertSameChoirRelation(
        ChatMessageModel,
        this.replyTo,
        this.choirId,
        'replyTo'
    );
});

ChatMessageSchema.index({ choirId: 1, createdAt: -1 });
ChatMessageSchema.index({ choirId: 1, author: 1, createdAt: -1 });
ChatMessageSchema.index({ choirId: 1, replyTo: 1 });

const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;
