// src/models/GalleryImage.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { MediaResourceType } from '../types/media.types';

export type GalleryMediaType = 'IMAGE' | 'VIDEO';

export interface IGalleryImage extends Document<Types.ObjectId> {
    title: string;
    description: string;
    imageUrl: string;
    imagePublicId?: string | null;
    mediaResourceType?: MediaResourceType | null;
    mediaAssetId?: Types.ObjectId | null;
    mediaType: GalleryMediaType;
    imageStart: boolean;
    imageTopBar: boolean;
    imageUs: boolean;
    imageLogo: boolean;
    imageGallery: boolean;
    imageLeftMenu: boolean;
    imageRightMenu: boolean;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const GalleryImageSchema = new Schema<IGalleryImage>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        imageUrl: { type: String, required: true },
        imagePublicId: { type: String, default: null },
        mediaResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        mediaAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
        mediaType: {
            type: String,
            enum: ['IMAGE', 'VIDEO'],
            default: 'IMAGE',
            uppercase: true
        },
        imageStart: { type: Boolean, default: false },
        imageTopBar: { type: Boolean, default: false },
        imageUs: { type: Boolean, default: false },
        imageLogo: { type: Boolean, default: false },
        imageGallery: { type: Boolean, default: false },
        imageLeftMenu: { type: Boolean, default: false },
        imageRightMenu: { type: Boolean, default: false },
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

GalleryImageSchema.index({ choirId: 1, createdAt: -1 });
GalleryImageSchema.index({ choirId: 1, imageGallery: 1, createdAt: -1 });

const GalleryImage = model<IGalleryImage>('GalleryImage', GalleryImageSchema);
export default GalleryImage;
