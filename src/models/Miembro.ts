import { Schema, model, Document } from 'mongoose';

export interface IMiembro extends Document {
    nombre: string;
    instrumento: string;
    tieneVoz: boolean;
    fotoPerfilUrl?: string;
    fotoPerfilPublicId?: string;
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
        }
    },
    { timestamps: true }
);

const Miembro = model<IMiembro>('Miembro', MiembroSchema);

export default Miembro;
