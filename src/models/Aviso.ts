import { Schema, model, Document } from 'mongoose';

export interface IAviso extends Document {
    titulo: string;
    contenido: string;
    imagenUrl?: string;
    imagenPublicId?: string;
    publicado: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const AvisoSchema = new Schema<IAviso>(
    {
        titulo: { type: String, required: true },
        contenido: { type: String, required: true },
        imagenUrl: { type: String, default: '' },
        imagenPublicId: { type: String, default: null },
        publicado: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const Aviso = model<IAviso>('Aviso', AvisoSchema);

export default Aviso;
