import { Schema, model, Document, Types } from 'mongoose';

export interface ISong extends Document {
    title: string;
    composer?: string;
    content: any; // TipTap
    audioUrl?: string;
    
    songTypeId?: Types.ObjectId; // Reference
    // songTypeName: string; // We don't store this, we populate it
    
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const SongSchema = new Schema<ISong>(
    {
        title: { type: String, required: true },
        composer: { type: String, default: '' },
        content: { type: Schema.Types.Mixed, required: true },
        audioUrl: { type: String, default: '' },
        
        songTypeId: { type: Schema.Types.ObjectId, ref: 'SongType', default: null },
        
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

SongSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        
        // Flatten relationship for Frontend convenience
        if (ret.songTypeId && typeof ret.songTypeId === 'object') {
            ret.songTypeName = ret.songTypeId.name;
            ret.songTypeId = ret.songTypeId._id;
        }
    }
});

export const Song = model<ISong>('Song', SongSchema);
export default Song;