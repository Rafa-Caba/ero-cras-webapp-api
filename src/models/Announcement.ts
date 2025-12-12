import { Schema, model, Document, Types } from 'mongoose';

export interface IAnnouncement extends Document {
    title: string;
    content: any;
    imageUrl?: string;
    imagePublicId?: string;
    isPublic: boolean;
    choirId?: Types.ObjectId;
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

        choirId: { type: Schema.Types.ObjectId, ref: 'Choir', default: null },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

AnnouncementSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret: any) {
        if (ret._id) {
            ret.id = ret._id.toString();
            delete ret._id;
        }
        return ret;
    }
});

const Announcement = model<IAnnouncement>('Announcement', AnnouncementSchema);
export default Announcement;
