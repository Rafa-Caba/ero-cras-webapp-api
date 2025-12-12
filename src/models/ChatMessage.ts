import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'MEDIA' | 'REACTION' | 'AUDIO' | 'VIDEO';

export interface ChatReaction {
    emoji: string;
    user: Types.ObjectId;
}

export interface ChatReplyPreview {
    id: string;
    username: string;
    textPreview: string;
}

export interface IChatMessage extends Document {
    author: Types.ObjectId;
    choirId?: Types.ObjectId | null;

    content: any;
    type: MessageType;

    fileUrl?: string;
    filename?: string;
    imageUrl?: string;
    audioUrl?: string;
    imagePublicId?: string;

    reactions: ChatReaction[];

    replyTo?: Types.ObjectId | IChatMessage | null;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const MAX_PREVIEW_LENGTH = 120;

function getTextPreviewFromContent(content: any): string {
    if (!content) return '';

    if (typeof content === 'string') {
        const trimmed = content.trim();
        if (!trimmed) return '';
        return trimmed.length > MAX_PREVIEW_LENGTH
            ? trimmed.slice(0, MAX_PREVIEW_LENGTH) + '…'
            : trimmed;
    }

    if (typeof content === 'object') {
        const root: any = content;

        const texts: string[] = [];

        const walk = (node: any) => {
            if (!node) return;

            if (node.type === 'text' && typeof node.text === 'string') {
                texts.push(node.text);
            }

            if (Array.isArray(node.content)) {
                node.content.forEach(walk);
            }
        };

        if (Array.isArray(root.content)) {
            root.content.forEach(walk);
        }

        const joined = texts.join(' ').replace(/\s+/g, ' ').trim();
        if (!joined) return '';

        return joined.length > MAX_PREVIEW_LENGTH
            ? joined.slice(0, MAX_PREVIEW_LENGTH) + '…'
            : joined;
    }

    return '';
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            default: null,
        },

        content: { type: Schema.Types.Mixed, required: true },
        type: {
            type: String,
            enum: ['TEXT', 'IMAGE', 'FILE', 'MEDIA', 'REACTION', 'AUDIO', 'VIDEO'],
            required: true,
        },

        fileUrl: { type: String, default: '' },
        filename: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        audioUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },

        reactions: [
            {
                emoji: { type: String, required: true },
                user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            },
        ],

        replyTo: {
            type: Schema.Types.ObjectId,
            ref: 'ChatMessage',
            default: null,
        },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    },
);

ChatMessageSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;

        if (ret.choirId) {
            ret.choirId = ret.choirId.toString();
        }

        if (Array.isArray(ret.reactions)) {
            ret.reactions = ret.reactions.map((r: any) => {
                const user = r.user;
                return {
                    emoji: r.emoji,
                    user: typeof user === 'object' && user !== null ? user._id?.toString() : user,
                    username:
                        typeof user === 'object' && user !== null
                            ? user.username
                            : undefined,
                };
            });
        }

        if (ret.replyTo && typeof ret.replyTo === 'object') {
            const reply = ret.replyTo;

            const replyId: string | undefined = reply._id
                ? reply._id.toString()
                : typeof reply.id === 'string'
                    ? reply.id
                    : undefined;

            const replyAuthor = reply.author || {};
            const replyUsername: string =
                typeof replyAuthor === 'object' && replyAuthor !== null
                    ? replyAuthor.username || 'Usuario'
                    : 'Usuario';

            const preview = getTextPreviewFromContent(reply.content);
            const textPreview = preview || '[mensaje]';

            ret.replyTo = replyId
                ? {
                    id: replyId,
                    username: replyUsername,
                    textPreview,
                }
                : null;
        } else {
            ret.replyTo = null;
        }

        return ret;
    },
});

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;
