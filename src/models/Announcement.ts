// src/models/Announcement.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { StoredJsonValue } from '../types/content.types';

export interface IAnnouncement extends Document<Types.ObjectId> {
    title: string;
    content: StoredJsonValue;
    imageUrl?: string;
    imagePublicId?: string | null;
    isPublic: boolean;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
    {
        title: { type: String, required: true, trim: true },
        content: { type: Schema.Types.Mixed, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },
        isPublic: { type: Boolean, default: false },
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

AnnouncementSchema.index({ choirId: 1, createdAt: -1 });
AnnouncementSchema.index({ choirId: 1, isPublic: 1, createdAt: -1 });

const Announcement = model<IAnnouncement>('Announcement', AnnouncementSchema);
export default Announcement;
