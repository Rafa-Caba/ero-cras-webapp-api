import { Schema, model, Document, Types } from 'mongoose';

export interface IInstrument extends Document {
    name: string;
    slug: string;
    category: string;
    iconKey: string;

    iconUrl?: string;
    iconPublicId?: string;

    isActive: boolean;
    order: number;

    choirId: Types.ObjectId;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt?: Date;
    updatedAt?: Date;
}

const InstrumentSchema = new Schema<IInstrument>(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true
        },
        category: { type: String, default: 'other', trim: true },

        iconKey: { type: String, required: true, trim: true },

        iconUrl: { type: String, default: '' },
        iconPublicId: { type: String, default: null },

        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 },

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

InstrumentSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
    }
});

const Instrument = model<IInstrument>('Instrument', InstrumentSchema);
export default Instrument;
