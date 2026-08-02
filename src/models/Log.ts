// src/models/Log.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { StoredJsonObject } from '../types/content.types';

export type LogAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'add_reaction'
    | 'remove_reaction';

export interface ILog extends Document<Types.ObjectId> {
    action: LogAction;
    collectionName: string;
    referenceId: Types.ObjectId;
    user: Types.ObjectId;
    choirId: Types.ObjectId;
    description?: string;
    changes?: StoredJsonObject;
    createdAt?: Date;
}

const LogSchema = new Schema<ILog>(
    {
        action: {
            type: String,
            enum: ['create', 'update', 'delete', 'add_reaction', 'remove_reaction'],
            required: true
        },
        collectionName: { type: String, required: true, trim: true },
        referenceId: { type: Schema.Types.ObjectId, required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        choirId: { type: Schema.Types.ObjectId, ref: 'Choir', required: true },
        description: { type: String, default: '' },
        changes: { type: Schema.Types.Mixed, default: {} }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

LogSchema.index({ choirId: 1, createdAt: -1 });
LogSchema.index({ choirId: 1, user: 1, createdAt: -1 });
LogSchema.index({ choirId: 1, collectionName: 1, referenceId: 1 });

const Log = model<ILog>('Log', LogSchema);
export default Log;
