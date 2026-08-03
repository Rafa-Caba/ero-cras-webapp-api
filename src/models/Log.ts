// src/models/Log.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { StoredJsonObject } from '../types/content.types';
import type { UserRole } from '../types/roles.types';

export type LogAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'add_reaction'
    | 'remove_reaction';

export interface ILog extends Document<Types.ObjectId> {
    action: LogAction;
    operation: string;
    collectionName: string;
    referenceId: Types.ObjectId;
    user: Types.ObjectId;
    actorUserId: Types.ObjectId;
    actorRole: UserRole;
    choirId: Types.ObjectId;
    targetChoirId: Types.ObjectId;
    targetUserId?: Types.ObjectId | null;
    description?: string;
    before?: StoredJsonObject | null;
    after?: StoredJsonObject | null;
    changes?: StoredJsonObject;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    timestamp: Date;
    createdAt?: Date;
}

const LogSchema = new Schema<ILog>(
    {
        action: {
            type: String,
            enum: ['create', 'update', 'delete', 'add_reaction', 'remove_reaction'],
            required: true
        },
        operation: { type: String, required: true, trim: true, index: true },
        collectionName: { type: String, required: true, trim: true },
        referenceId: { type: Schema.Types.ObjectId, required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        actorRole: {
            type: String,
            enum: ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'USER', 'VIEWER'],
            required: true
        },
        choirId: { type: Schema.Types.ObjectId, ref: 'Choir', required: true },
        targetChoirId: { type: Schema.Types.ObjectId, ref: 'Choir', required: true },
        targetUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        description: { type: String, default: '' },
        before: { type: Schema.Types.Mixed, default: null },
        after: { type: Schema.Types.Mixed, default: null },
        changes: { type: Schema.Types.Mixed, default: {} },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        deviceId: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now, required: true }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

LogSchema.index({ choirId: 1, createdAt: -1 });
LogSchema.index({ targetChoirId: 1, createdAt: -1 });
LogSchema.index({ user: 1, createdAt: -1 });
LogSchema.index({ actorUserId: 1, timestamp: -1 });
LogSchema.index({ targetUserId: 1, createdAt: -1 });
LogSchema.index({ actorRole: 1, createdAt: -1 });
LogSchema.index({ collectionName: 1, referenceId: 1, createdAt: -1 });

const Log = model<ILog>('Log', LogSchema);
export default Log;
