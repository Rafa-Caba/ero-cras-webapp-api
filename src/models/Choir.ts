import { Schema, model, Document, Types } from 'mongoose';

export interface IChoir extends Document {
    name: string;
    code: string;
    description?: string;

    logoUrl?: string;
    logoPublicId?: string;

    isActive: boolean;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt?: Date;
    updatedAt?: Date;
}

const ChoirSchema = new Schema<IChoir>(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, lowercase: true, unique: true },

        description: { type: String, default: '' },

        logoUrl: { type: String, default: '' },
        logoPublicId: { type: String, default: null },

        isActive: { type: Boolean, default: true },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

ChoirSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;

        return ret;
    }
});

const Choir = model<IChoir>('Choir', ChoirSchema);
export default Choir;
