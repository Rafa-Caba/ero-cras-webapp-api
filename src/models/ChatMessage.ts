import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
    author: Types.ObjectId;
    content: any; // TipTap JSON
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'MEDIA' | 'REACTION' | 'AUDIO' | 'VIDEO';
    
    // Generic storage for any media URL
    fileUrl?: string; 
    filename?: string;
    
    reactions: Array<{
        emoji: string;
        username: string;
    }>;
    
    replyTo?: Types.ObjectId;
    createdBy?: Types.ObjectId;
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
        
        // We use fileUrl for EVERYTHING (Image, Audio, Video, Pdf)
        fileUrl: { type: String, default: '' },
        filename: { type: String, default: '' },
        
        reactions: [{
            emoji: String,
            username: String 
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
        
        // Convenience aliases for Frontend which expects specific keys
        if (ret.type === 'IMAGE' || ret.type === 'VIDEO') {
            ret.imageUrl = ret.fileUrl;
        } else if (ret.type === 'AUDIO') {
            ret.audioUrl = ret.fileUrl;
        }
    }
});

const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;