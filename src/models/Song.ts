// src/models/Song.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation } from '../services/tenantRelation.service';
import type { StoredJsonValue } from '../types/content.types';
import type { MediaResourceType } from '../types/media.types';
import SongType from './SongType';

export interface ISong extends Document<Types.ObjectId> {
    title: string;
    composer?: string;
    content: StoredJsonValue;
    audioUrl?: string;
    audioPublicId?: string | null;
    audioResourceType?: MediaResourceType | null;
    audioAssetId?: Types.ObjectId | null;
    songTypeId?: Types.ObjectId | null;
    songTypeName?: string;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const SongSchema = new Schema<ISong>(
    {
        title: { type: String, required: true, trim: true },
        composer: { type: String, default: '', trim: true },
        content: { type: Schema.Types.Mixed, required: true },
        audioUrl: { type: String, default: '' },
        audioPublicId: { type: String, default: null },
        audioResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        audioAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
        songTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'SongType',
            default: null
        },
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

SongSchema.pre('validate', async function validateSongTypeRelation(this: ISong): Promise<void> {
    await assertSameChoirRelation(
        SongType,
        this.songTypeId,
        this.choirId,
        'songTypeId'
    );
});

SongSchema.index({ choirId: 1, title: 1 });
SongSchema.index({ choirId: 1, songTypeId: 1, title: 1 });

export const Song = model<ISong>('Song', SongSchema);
export default Song;
