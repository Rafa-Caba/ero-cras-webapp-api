import { Schema, model, Document, Types } from 'mongoose';

export interface IMember extends Document {
    name: string;
    instrument: string;
    voice: boolean;
    imageUrl?: string;
    imagePublicId?: string;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt?: Date;
    updatedAt?: Date;
}

const MemberSchema = new Schema<IMember>(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        instrument: {
            type: String,
            required: true,
            trim: true
        },
        voice: {
            type: Boolean,
            default: false,
            required: true
        },
        imageUrl: {
            type: String,
            default: ''
        },
        imagePublicId: {
            type: String,
            default: null
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        }
    },
    { timestamps: true }
);

MemberSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
    }
});

const Member = model<IMember>('Member', MemberSchema);

export default Member;