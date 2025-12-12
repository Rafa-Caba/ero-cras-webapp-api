import { Schema, model, Document, Types } from 'mongoose';

export interface ILog extends Document {
    action: 'create' | 'update' | 'delete' | 'add_reaction' | 'remove_reaction';
    collectionName: string;
    referenceId: Types.ObjectId;
    user: Types.ObjectId;
    choirId: Types.ObjectId;

    description?: string;
    changes?: Record<string, any>;
    createdAt?: Date;
}

const LogSchema = new Schema<ILog>(
    {
        action: {
            type: String,
            enum: ['create', 'update', 'delete', 'add_reaction', 'remove_reaction'],
            required: true
        },
        collectionName: {
            type: String,
            required: true
        },
        referenceId: {
            type: Schema.Types.ObjectId,
            required: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        description: {
            type: String,
            default: ''
        },
        changes: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false
    }
);

LogSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const Log = model<ILog>('Log', LogSchema);

export default Log;
