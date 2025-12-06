import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
    author: Types.ObjectId;
    content: any;
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'MEDIA' | 'REACTION' | 'AUDIO' | 'VIDEO';

    fileUrl?: string;
    filename?: string;

    reactions: Array<{
        user: Types.ObjectId;
        emoji: string;
    }>;

    replyTo?: Types.ObjectId;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: Schema.Types.Mixed, default: {} },
        type: {
            type: String,
            enum: ['TEXT', 'IMAGE', 'FILE', 'MEDIA', 'REACTION', 'AUDIO', 'VIDEO'],
            default: 'TEXT',
            uppercase: true
        },

        fileUrl: { type: String, default: '' },
        filename: { type: String, default: '' },

        reactions: [{
            user: { type: Schema.Types.ObjectId, ref: 'User' },
            emoji: String
        }],

        replyTo: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

ChatMessageSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;

        if (ret.type === 'IMAGE' || ret.type === 'VIDEO') {
            ret.imageUrl = ret.fileUrl;
        } else if (ret.type === 'AUDIO') {
            ret.audioUrl = ret.fileUrl;
        }

        if (ret.replyTo && typeof ret.replyTo === 'object') {
            const reply = ret.replyTo;
            const author = reply.author || {};
            const username = author.username || author.name || 'Usuario';

            let textPreview = '';
            if (typeof reply.content === 'string') {
                textPreview = reply.content;
            } else if (reply.content && typeof reply.content === 'object') {
                textPreview =
                    reply.content.text ||
                    (Array.isArray(reply.content.content) && reply.content.content[0]?.text) ||
                    '[mensaje]';
            } else {
                textPreview = '[mensaje]';
            }

            ret.replyTo = {
                id: reply._id,
                username,
                textPreview
            };
        }
    }
});


const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;