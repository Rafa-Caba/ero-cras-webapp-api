// src/models/Member.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation } from '../services/tenantRelation.service';
import Instrument from './Instrument';

export interface IMember extends Document<Types.ObjectId> {
    name: string;
    instrumentId?: Types.ObjectId | null;
    instrumentLabel?: string;
    voice: boolean;
    imageUrl?: string;
    imagePublicId?: string | null;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const MemberSchema = new Schema<IMember>(
    {
        name: { type: String, required: true, trim: true },
        instrumentId: {
            type: Schema.Types.ObjectId,
            ref: 'Instrument',
            default: null
        },
        instrumentLabel: { type: String, default: '' },
        voice: { type: Boolean, default: false, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },
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

MemberSchema.pre('validate', async function validateInstrumentRelation(this: IMember): Promise<void> {
    await assertSameChoirRelation(
        Instrument,
        this.instrumentId,
        this.choirId,
        'instrumentId'
    );
});

MemberSchema.index({ choirId: 1, name: 1 });
MemberSchema.index({ choirId: 1, instrumentId: 1 });

const Member = model<IMember>('Member', MemberSchema);
export default Member;
