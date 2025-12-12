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
    imageRightMenu?: boolean;

    choirId: Types.ObjectId;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const GalleryImageSchema = new Schema<IGalleryImage>(
    {
        title: { type: String, required: true },
        description: { type: String, default: '' },
        imageUrl: { type: String, required: true },
        imagePublicId: { type: String, default: null },
        mediaType: {
            type: String,
            enum: ['IMAGE', 'VIDEO'],
            default: 'IMAGE',
            uppercase: true
        },

        // Boolean Flags
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
    { timestamps: true }
);

GalleryImageSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const GalleryImage = model<IGalleryImage>('GalleryImage', GalleryImageSchema);
export default GalleryImage;
