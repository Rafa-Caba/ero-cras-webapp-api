// src/models/SongType.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation } from '../services/tenantRelation.service';

export interface ISongType extends Document<Types.ObjectId> {
    name: string;
    order: number;
    parentId?: Types.ObjectId | null;
    isParent: boolean;
    choirId: Types.ObjectId;
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
            required: true
        },
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

SongTypeSchema.pre('validate', async function validateParentRelation(this: ISongType): Promise<void> {
    if (this.parentId && this._id.equals(this.parentId)) {
        throw new Error('parentId cannot reference the same song type');
    }

    if (!this.parentId) {
        return;
    }

    const SongTypeModel = model<ISongType>('SongType');
    await assertSameChoirRelation(
        SongTypeModel,
        this.parentId,
        this.choirId,
        'parentId'
    );
});

SongTypeSchema.index(
    { choirId: 1, name: 1, parentId: 1 },
    { unique: true, name: 'song_type_choir_name_parent_unique' }
);
SongTypeSchema.index({ choirId: 1, order: 1 });

export const SongType = model<ISongType>('SongType', SongTypeSchema);
export default SongType;
