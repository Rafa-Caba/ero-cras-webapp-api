// src/models/Notification.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation } from '../services/tenantRelation.service';
import {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
    type NotificationCategory,
    type NotificationType
} from '../types/notification.types';
import User from './User';

export interface INotification extends Document<Types.ObjectId> {
    choirId: Types.ObjectId;
    recipientUserId: Types.ObjectId;
    actorUserId?: Types.ObjectId | null;
    category: NotificationCategory;
    type: NotificationType;
    title: string;
    body: string;
    resourceId: Types.ObjectId;
    resourceSubId?: Types.ObjectId | null;
    dedupeKey: string;
    isRead: boolean;
    readAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        recipientUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        actorUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        category: {
            type: String,
            enum: [...NOTIFICATION_CATEGORIES],
            required: true
        },
        type: {
            type: String,
            enum: [...NOTIFICATION_TYPES],
            required: true
        },
        title: { type: String, required: true, trim: true },
        body: { type: String, required: true, trim: true },
        resourceId: { type: Schema.Types.ObjectId, required: true },
        resourceSubId: { type: Schema.Types.ObjectId, default: null },
        dedupeKey: { type: String, required: true, trim: true },
        isRead: { type: Boolean, default: false },
        readAt: { type: Date, default: null }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

NotificationSchema.pre(
    'validate',
    async function validateNotificationTenant(this: INotification): Promise<void> {
        await assertSameChoirRelation(
            User,
            this.recipientUserId,
            this.choirId,
            'recipientUserId'
        );

        if (this.actorUserId) {
            await assertSameChoirRelation(
                User,
                this.actorUserId,
                this.choirId,
                'actorUserId'
            );
        }
    }
);

NotificationSchema.index(
    { recipientUserId: 1, choirId: 1, isRead: 1, createdAt: -1 },
    { name: 'notification_recipient_unread_created' }
);
NotificationSchema.index(
    { recipientUserId: 1, dedupeKey: 1 },
    { unique: true, name: 'notification_recipient_dedupe_unique' }
);
NotificationSchema.index(
    { recipientUserId: 1, choirId: 1, category: 1, createdAt: -1 },
    { name: 'notification_recipient_category_created' }
);

const Notification = model<INotification>('Notification', NotificationSchema);
export default Notification;
