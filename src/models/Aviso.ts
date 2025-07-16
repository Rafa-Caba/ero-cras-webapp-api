import { Schema, model, Document, Types } from 'mongoose';
import type { JSONContent } from '@tiptap/react';

export interface IAviso extends Document {
    titulo: string;
    contenido: JSONContent;
    imagenUrl?: string;
    imagenPublicId?: string;
    publicado: boolean;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const AvisoSchema = new Schema<IAviso>(
    {
        titulo: { type: String, required: true },
        contenido: {
            type: Schema.Types.Mixed,
            required: true
        },
        imagenUrl: { type: String, default: '' },
        imagenPublicId: { type: String, default: null },
        publicado: { type: Boolean, default: false },
        creadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false,
        },
        actualizadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false
        }
    },
    { timestamps: true }
);

const Aviso = model<IAviso>('Aviso', AvisoSchema);

export default Aviso;
