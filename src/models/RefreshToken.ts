// src/models/RefreshToken.ts

import { Document, Schema, Types, model } from 'mongoose';

export interface IRefreshToken extends Document<Types.ObjectId> {
    tokenHash: string;
    tokenId: string;
    userId: Types.ObjectId;
    sessionVersion: number;
    expiresAt: Date;
    revokedAt?: Date | null;
    replacedByTokenHash?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
    {
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },
        tokenId: {
            type: String,
            required: true,
            unique: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        sessionVersion: {
            type: Number,
            required: true,
            min: 1
        },
        expiresAt: {
            type: Date,
            required: true
        },
        revokedAt: {
            type: Date,
            default: null
        },
        replacedByTokenHash: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });

const RefreshToken = model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
export default RefreshToken;
