// src/models/PushReceipt.ts

import { Document, Schema, Types, model } from 'mongoose';
import {
    PUSH_RECEIPT_STATUSES,
    type PushReceiptStatus
} from '../types/push.types';

export interface IPushReceipt extends Document<Types.ObjectId> {
    ticketId: string;
    pushDeviceId: Types.ObjectId;
    status: PushReceiptStatus;
    errorCode?: string;
    errorMessage?: string;
    attempts: number;
    nextAttemptAt: Date;
    processedAt?: Date | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PushReceiptSchema = new Schema<IPushReceipt>(
    {
        ticketId: {
            type: String,
            required: true,
            trim: true
        },
        pushDeviceId: {
            type: Schema.Types.ObjectId,
            ref: 'PushDevice',
            required: true
        },
        status: {
            type: String,
            enum: [...PUSH_RECEIPT_STATUSES],
            default: 'PENDING',
            required: true
        },
        errorCode: {
            type: String,
            default: ''
        },
        errorMessage: {
            type: String,
            default: ''
        },
        attempts: {
            type: Number,
            default: 0,
            min: 0
        },
        nextAttemptAt: {
            type: Date,
            required: true
        },
        processedAt: {
            type: Date,
            default: null
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

PushReceiptSchema.index(
    { ticketId: 1 },
    { unique: true, name: 'push_receipt_ticket_unique' }
);
PushReceiptSchema.index({ status: 1, nextAttemptAt: 1 });
PushReceiptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PushReceipt = model<IPushReceipt>('PushReceipt', PushReceiptSchema);
export default PushReceipt;
