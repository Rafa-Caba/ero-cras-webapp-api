// src/models/MediaAsset.ts

import { Document, Schema, Types, model } from 'mongoose';
import {
    MEDIA_ASSET_STATUSES,
    MEDIA_OWNER_TYPES,
    MEDIA_RESOURCE_TYPES,
    type MediaAssetStatus,
    type MediaOwnerType,
    type MediaResourceType
} from '../types/media.types';

export interface IMediaAsset extends Document<Types.ObjectId> {
    choirId: Types.ObjectId;
    uploadedBy: Types.ObjectId;
    ownerType: MediaOwnerType;
    ownerId?: Types.ObjectId | null;
    publicId: string;
    resourceType: MediaResourceType;
    url: string;
    bytes: number;
    format: string;
    originalName: string;
    mimeType: string;
    status: MediaAssetStatus;
    orphanedReason?: string;
    attachedAt?: Date | null;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
    {
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        ownerType: {
            type: String,
            enum: [...MEDIA_OWNER_TYPES],
            required: true
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            default: null
        },
        publicId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },
        resourceType: {
            type: String,
            enum: [...MEDIA_RESOURCE_TYPES],
            required: true
        },
        url: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        bytes: {
            type: Number,
            required: true,
            min: 0
        },
        format: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30
        },
        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },
        mimeType: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },
        status: {
            type: String,
            enum: [...MEDIA_ASSET_STATUSES],
            default: 'PENDING',
            required: true
        },
        orphanedReason: {
            type: String,
            default: '',
            maxlength: 250
        },
        attachedAt: {
            type: Date,
            default: null
        },
        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

MediaAssetSchema.index(
    { publicId: 1 },
    { unique: true, name: 'media_asset_public_id_unique' }
);
MediaAssetSchema.index({ choirId: 1, status: 1, createdAt: 1 });
MediaAssetSchema.index({ choirId: 1, ownerType: 1, ownerId: 1 });
MediaAssetSchema.index({ uploadedBy: 1, status: 1 });

const MediaAsset = model<IMediaAsset>('MediaAsset', MediaAssetSchema);
export default MediaAsset;
