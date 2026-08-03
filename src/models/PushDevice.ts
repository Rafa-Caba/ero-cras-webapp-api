// src/models/PushDevice.ts

import { Document, Schema, Types, model } from 'mongoose';
import {
    PUSH_PLATFORMS,
    type PushPlatform
} from '../types/push.types';

export interface IPushDevice extends Document<Types.ObjectId> {
    userId: Types.ObjectId;
    choirId: Types.ObjectId;
    deviceId: string;
    expoPushToken: string;
    platform: PushPlatform;
    deviceName?: string;
    appVersion?: string;
    isActive: boolean;
    registeredAt: Date;
    lastSeenAt: Date;
    invalidatedAt?: Date | null;
    invalidationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PushDeviceSchema = new Schema<IPushDevice>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        deviceId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        expoPushToken: {
            type: String,
            required: true,
            trim: true,
            maxlength: 256,
            select: false
        },
        platform: {
            type: String,
            enum: [...PUSH_PLATFORMS],
            required: true
        },
        deviceName: {
            type: String,
            default: '',
            trim: true,
            maxlength: 120
        },
        appVersion: {
            type: String,
            default: '',
            trim: true,
            maxlength: 50
        },
        isActive: {
            type: Boolean,
            default: true
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        lastSeenAt: {
            type: Date,
            default: Date.now
        },
        invalidatedAt: {
            type: Date,
            default: null
        },
        invalidationReason: {
            type: String,
            default: '',
            maxlength: 250
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

PushDeviceSchema.index(
    { userId: 1, choirId: 1, deviceId: 1 },
    { unique: true, name: 'push_device_user_choir_device_unique' }
);
PushDeviceSchema.index(
    { expoPushToken: 1 },
    {
        unique: true,
        name: 'push_device_active_token_unique',
        partialFilterExpression: { isActive: true }
    }
);
PushDeviceSchema.index({ choirId: 1, isActive: 1 });
PushDeviceSchema.index({ userId: 1, isActive: 1 });

const PushDevice = model<IPushDevice>('PushDevice', PushDeviceSchema);
export default PushDevice;
