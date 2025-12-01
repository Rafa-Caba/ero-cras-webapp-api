import { Schema, model, Document, Types } from 'mongoose';

export interface IGalleryImage extends Document {
    title: string;
    description: string;
    imageUrl: string;
    imagePublicId?: string;
    mediaType: 'IMAGE' | 'VIDEO';

    imageStart: boolean;
    imageTopBar: boolean;
    imageUs: boolean;
    imageLogo: boolean;
    imageGallery: boolean;
    imageLeftMenu?: boolean;
    imageRightMenu?: boolean

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const GalleryImageSchema = new Schema<IGalleryImage>(
    {
        title: { type: String, required: true },
        description: { type: String, default: '' },
        imageUrl: { type: String, required: true },
        imagePublicId: { type: String, default: null },
        mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], default: 'IMAGE', uppercase: true },

        // Boolean Flags
        imageStart: { type: Boolean, default: false },
        imageTopBar: { type: Boolean, default: false },
        imageUs: { type: Boolean, default: false },
        imageLogo: { type: Boolean, default: false },
        imageGallery: { type: Boolean, default: false },
        imageLeftMenu: { type: Boolean, default: false },
        imageRightMenu: { type: Boolean, default: false },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

GalleryImageSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
    }
});

const GalleryImage = model<IGalleryImage>('GalleryImage', GalleryImageSchema);
export default GalleryImage;