import { Schema, model, Document, Types } from 'mongoose';

export interface IMiembro extends Document {
    nombre: string;
    instrumento: string;
    tieneVoz: boolean;
    fotoPerfilUrl?: string;
    fotoPerfilPublicId?: string;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const MiembroSchema = new Schema<IMiembro>(
    {
        nombre: {
            type: String,
            required: true,
            trim: true
        },
        instrumento: {
            type: String,
            required: true,
            trim: true
        },
        tieneVoz: {
            type: Boolean,
            default: false,
            required: true
        },
        fotoPerfilUrl: {
            type: String,
            default: ''
        },
        fotoPerfilPublicId: {
            type: String,
            default: null
        },
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

const Miembro = model<IMiembro>('Miembro', MiembroSchema);

export default Miembro;
