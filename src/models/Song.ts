import { Schema, model, Document, Types } from 'mongoose';

export interface ISong extends Document {
    title: string;
    composer?: string;
    content: any;
    audioUrl?: string;

    songTypeId?: Types.ObjectId | null;
    songTypeName?: string;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const SongSchema = new Schema<ISong>(
    {
        title: { type: String, required: true, trim: true },
        composer: { type: String, default: '', trim: true },
        content: { type: Schema.Types.Mixed, required: true },
        audioUrl: { type: String, default: '' },

        songTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'SongType',
            default: null
        },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

SongSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
    }
});

export const Song = model<ISong>('Song', SongSchema);
export default Song;
