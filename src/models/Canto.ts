import { Schema, model, Document, Types } from 'mongoose';

export interface ICanto extends Document {
    titulo: string;
    texto: { type: Schema.Types.Mixed, required: true },
    tipo?: string;
    compositor?: string;
    fecha?: Date;
    url?: string;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const CantoSchema = new Schema<ICanto>(
    {
        titulo: {
            type: String,
            required: true,
        },
        texto: {
            type: Schema.Types.Mixed,
            required: true
        },
        tipo: String,
        compositor: String,
        fecha: Date,
        url: String,
        creadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false, // o true si siempre debe haber autor
        },
        actualizadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false
        }
    },
    { timestamps: true }
);

const Canto = model<ICanto>('Canto', CantoSchema);

export default Canto;
