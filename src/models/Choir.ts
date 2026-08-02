// src/models/Choir.ts

import { Document, Schema, Types, model } from 'mongoose';

export interface IChoir extends Document<Types.ObjectId> {
    name: string;
    code: string;
    description?: string;
    logoUrl?: string;
    logoPublicId?: string | null;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export const normalizeChoirCode = (value: string): string => {
    return value.trim().toLowerCase();
};

const ChoirSchema = new Schema<IChoir>(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, lowercase: true },
        description: { type: String, default: '' },
        logoUrl: { type: String, default: '' },
        logoPublicId: { type: String, default: null },
        isActive: { type: Boolean, default: true },
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

ChoirSchema.pre('validate', function normalizeCode(this: IChoir): void {
    this.code = normalizeChoirCode(this.code);
});

ChoirSchema.index(
    { code: 1 },
    { unique: true, name: 'choir_code_unique' }
);
ChoirSchema.index({ isActive: 1, name: 1 });

const Choir = model<IChoir>('Choir', ChoirSchema);
export default Choir;
