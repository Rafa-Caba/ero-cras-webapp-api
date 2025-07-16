import mongoose, { Schema, model, Document } from 'mongoose';
import type { JSONContent } from '@tiptap/react';

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

    historiaNosotros: JSONContent;
    telefonoContacto: string;

    creadoPor?: mongoose.Types.ObjectId;
    actualizadoPor?: mongoose.Types.ObjectId;

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

        historiaNosotros: { type: Schema.Types.Mixed, required: true },
        telefonoContacto: { type: String, default: '' },

        // 👇 Esto probablemente falta
        creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
        actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    },
    { timestamps: true }
);

const Settings = model<ISetting>('Setting', SettingSchema);
export default Settings;
