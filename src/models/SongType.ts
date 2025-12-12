import { Schema, model, Document, Types } from 'mongoose';

export interface ISongType extends Document {
    name: string;
    order: number;
    parentId?: Types.ObjectId | null;
    isParent: boolean;

    choirId?: Types.ObjectId | null;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const SongTypeSchema = new Schema<ISongType>(
    {
        name: { type: String, required: true, trim: true },
        order: { type: Number, default: 0 },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'SongType',
            default: null
        },
        isParent: { type: Boolean, default: false },

        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            default: null,
            index: true
        },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true
    }
);

SongTypeSchema.index(
    { name: 1, parentId: 1, choirId: 1 },
    { unique: true }
);

SongTypeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;

        if (ret.parentId && typeof ret.parentId === 'object' && ret.parentId.toString) {
            ret.parentId = ret.parentId.toString();
        }

        if (ret.choirId && typeof ret.choirId === 'object' && ret.choirId.toString) {
            ret.choirId = ret.choirId.toString();
        }

        return ret;
    }
});

export const SongType = model<ISongType>('SongType', SongTypeSchema);
export default SongType;
