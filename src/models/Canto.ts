import { Schema, model, Document } from 'mongoose';

export interface ICanto extends Document {
    titulo: string;
    texto?: string;
    tipo?: string;
    compositor?: string;
    fecha?: Date;
    url?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const CantoSchema = new Schema<ICanto>(
    {
        titulo: {
            type: String,
            required: true,
        },
        texto: String,
        tipo: String,
        compositor: String,
        fecha: Date,
        url: String,
    },
    { timestamps: true }
);

const Canto = model<ICanto>('Canto', CantoSchema);

export default Canto;
