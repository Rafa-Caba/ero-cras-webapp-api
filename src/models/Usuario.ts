import { Schema, model, Document } from 'mongoose';

export interface IUsuario extends Document {
    nombre: string;
    username: string;
    correo: string;
    password: string;
    fotoPerfilUrl?: string;
    rol: 'admin' | 'editor' | 'viewer';
    createdAt?: Date;
    updatedAt?: Date;
}

const UsuarioSchema = new Schema<IUsuario>(
    {
        nombre: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        correo: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        fotoPerfilUrl: {
            type: String,
            default: ''
        },
        rol: {
            type: String,
            enum: ['admin', 'editor', 'viewer'],
            default: 'viewer'
        }
    },
    { timestamps: true }
);

const Usuario = model<IUsuario>('Usuario', UsuarioSchema);

export default Usuario;
