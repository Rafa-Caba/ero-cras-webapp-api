import { Schema, model, Document, Types } from 'mongoose';

export interface ISettings extends Document {
    webTitle: string;
    contactPhone: string;
    logoUrl?: string;
    logoPublicId?: string;

    socials: {
        facebook: string;
        instagram: string;
        youtube: string;
        whatsapp: string;
        email: string;
    };

    homeLegends: {
        principal: string;
        secondary: string;
    };

    history: any;

    choirId?: Types.ObjectId;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const SettingsSchema = new Schema<ISettings>(
    {
        webTitle: { type: String, default: 'Coro App' },
        contactPhone: { type: String, default: '' },
        logoUrl: { type: String, default: '' },
        logoPublicId: { type: String, default: null },

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
            required: false,
            index: true
        },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

SettingsSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const Settings = model<ISettings>('Settings', SettingsSchema);
export default Settings;
