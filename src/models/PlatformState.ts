// src/models/PlatformState.ts

import { Document, Schema, Types, model } from 'mongoose';

export interface IPlatformState extends Document<Types.ObjectId> {
    key: 'platform';
    superAdminBootstrapCompletedAt?: Date | null;
    superAdminBootstrapUserId?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const PlatformStateSchema = new Schema<IPlatformState>(
    {
        key: {
            type: String,
            enum: ['platform'],
            required: true,
            unique: true
        },
        superAdminBootstrapCompletedAt: {
            type: Date,
            default: null
        },
        superAdminBootstrapUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

const PlatformState = model<IPlatformState>(
    'PlatformState',
    PlatformStateSchema
);

export default PlatformState;
