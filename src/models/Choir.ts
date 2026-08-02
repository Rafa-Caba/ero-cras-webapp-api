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

const ChoirSchema = new Schema<IChoir>(
    {
        name: { type: String, required: true, trim: true },
        code: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true
        },

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

ChoirSchema.pre('validate', function normalizeChoirCode(this: IChoir): void {
    this.code = this.code.trim().toLowerCase();
});

const Choir = model<IChoir>('Choir', ChoirSchema);
export default Choir;
