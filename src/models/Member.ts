import { Schema, model, Document, Types } from 'mongoose';

export interface IMember extends Document {
    name: string;

    instrumentId?: Types.ObjectId;
    instrumentLabel?: string;

    voice: boolean;
    imageUrl?: string;
    imagePublicId?: string;

    choirId: Types.ObjectId;

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
        instrumentId: { type: Schema.Types.ObjectId, ref: 'Choir', default: null },
        instrumentLabel: { type: String, default: '' },
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
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
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
    transform: function (_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const Member = model<IMember>('Member', MemberSchema);

export default Member;
