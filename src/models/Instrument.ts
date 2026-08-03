// src/models/Instrument.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { MediaResourceType } from '../types/media.types';

export interface IInstrument extends Document<Types.ObjectId> {
    name: string;
    slug: string;
    category: string;
    iconKey: string;
    iconUrl?: string;
    iconPublicId?: string | null;
    iconResourceType?: MediaResourceType | null;
    iconAssetId?: Types.ObjectId | null;
    isActive: boolean;
    order: number;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const normalizeSlug = (value: string): string => value.trim().toLowerCase();

const InstrumentSchema = new Schema<IInstrument>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, lowercase: true },
        category: { type: String, default: 'other', trim: true },
        iconKey: { type: String, required: true, trim: true },
        iconUrl: { type: String, default: '' },
        iconPublicId: { type: String, default: null },
        iconResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        iconAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
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
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

InstrumentSchema.pre('validate', function normalizeInstrumentSlug(this: IInstrument): void {
    this.slug = normalizeSlug(this.slug);
});

InstrumentSchema.index(
    { choirId: 1, slug: 1 },
    { unique: true, name: 'instrument_choir_slug_unique' }
);
InstrumentSchema.index({ choirId: 1, isActive: 1, order: 1 });

const Instrument = model<IInstrument>('Instrument', InstrumentSchema);
export default Instrument;
