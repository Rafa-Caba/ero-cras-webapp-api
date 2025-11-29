import { Schema, model, Document, Types } from 'mongoose';

export interface IAnnouncement extends Document {
    title: string;
    content: any; // TipTap
    imageUrl?: string;
    imagePublicId?: string;
    isPublic: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
    {
        title: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },
        isPublic: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

AnnouncementSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
    }
});

const Announcement = model<IAnnouncement>('Announcement', AnnouncementSchema);
export default Announcement;