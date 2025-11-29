import { Schema, model, Document, Types } from 'mongoose';

export interface ISongType extends Document {
    name: string;
    order: number;
    // 🆕 Hierarchy Support
    parentId?: Types.ObjectId;
    isParent: boolean;         
    
    createdAt?: Date;
    updatedAt?: Date;
}

const SongTypeSchema = new Schema<ISongType>({
    name: { type: String, required: true, unique: true, trim: true },
    order: { type: Number, default: 0 },
    
    // 🆕 Hierarchy Fields
    parentId: { type: Schema.Types.ObjectId, ref: 'SongType', default: null },
    isParent: { type: Boolean, default: false }
}, { 
    timestamps: true 
});

SongTypeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        if (ret.parentId) ret.parentId = ret.parentId.toString();
    }
});

export const SongType = model<ISongType>('SongType', SongTypeSchema);
export default SongType;