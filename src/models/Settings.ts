// src/models/Settings.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { StoredJsonValue } from '../types/content.types';
import type { MediaResourceType } from '../types/media.types';

export interface SettingsSocials {
    facebook: string;
    instagram: string;
    youtube: string;
    whatsapp: string;
    email: string;
}

export interface SettingsHomeLegends {
    principal: string;
    secondary: string;
}

export interface ISettings extends Document<Types.ObjectId> {
    webTitle: string;
    contactPhone: string;
    logoUrl?: string;
    logoPublicId?: string | null;
    logoResourceType?: MediaResourceType | null;
    logoAssetId?: Types.ObjectId | null;
    socials: SettingsSocials;
    homeLegends: SettingsHomeLegends;
    history: StoredJsonValue;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const SettingsSchema = new Schema<ISettings>(
    {
        webTitle: { type: String, default: 'Coro App', trim: true },
        contactPhone: { type: String, default: '' },
        logoUrl: { type: String, default: '' },
        logoPublicId: { type: String, default: null },
        logoResourceType: { type: String, enum: ['image', 'video', 'raw'], default: null },
        logoAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
        socials: {
            facebook: { type: String, default: '' },
            instagram: { type: String, default: '' },
            youtube: { type: String, default: '' },
            whatsapp: { type: String, default: '' },
            email: { type: String, default: '' }
        },
        homeLegends: {
            principal: { type: String, default: '' },
            secondary: { type: String, default: '' }
        },
        history: { type: Schema.Types.Mixed, default: {} },
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

SettingsSchema.index(
    { choirId: 1 },
    { unique: true, name: 'settings_choir_unique' }
);

const Settings = model<ISettings>('Settings', SettingsSchema);
export default Settings;
