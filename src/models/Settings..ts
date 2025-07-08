import { Schema, model, Document } from 'mongoose';

export interface ISetting extends Document {
    tituloWeb: string;

    socialLinks: {
        facebook: string;
        instagram: string;
        youtube: string;
        whatsapp: string;
        correo: string;
    };

    leyendasInicio: {
        principal: string;
        secundaria: string;
    };

    historiaNosotros: string;
    telefonoContacto: string;

    createdAt?: Date;
    updatedAt?: Date;
}

const SettingSchema = new Schema<ISetting>(
    {
        tituloWeb: { type: String, default: 'Ero Cras Oficial' },

        socialLinks: {
            facebook: { type: String, default: '' },
            instagram: { type: String, default: '' },
            youtube: { type: String, default: '' },
            whatsapp: { type: String, default: '' },
            correo: { type: String, default: '' }
        },

        leyendasInicio: {
            principal: { type: String, default: '' },
            secundaria: { type: String, default: '' }
        },

        historiaNosotros: { type: String, default: '' },
        telefonoContacto: { type: String, default: '' }
    },
    { timestamps: true }
);

const Settings = model<ISetting>('Setting', SettingSchema);
export default Settings;
