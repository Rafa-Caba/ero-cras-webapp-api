import { Schema, model, Document } from 'mongoose';

export interface IImagen extends Document {
    titulo: string;
    descripcion: string;
    imagenUrl: string;
    imagenPublicId?: string; // ✅ nuevo campo para Cloudinary
    imagenInicio?: boolean;
    imagenLeftMenu?: boolean;
    imagenRightMenu?: boolean;
    imagenNosotros?: boolean;
    imagenLogo?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const ImagenSchema = new Schema<IImagen>(
    {
        titulo: {
            type: String,
            required: true,
        },
        descripcion: {
            type: String,
            required: true,
        },
        imagenUrl: {
            type: String,
            required: true,
        },
        imagenPublicId: {
            type: String,
            default: null, // ✅ opcional para imágenes locales
        },
        imagenInicio: {
            type: Boolean,
            default: false,
        },
        imagenLeftMenu: {
            type: Boolean,
            default: false,
        },
        imagenRightMenu: {
            type: Boolean,
            default: false,
        },
        imagenNosotros: {
            type: Boolean,
            default: false,
        },
        imagenLogo: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Imagen = model<IImagen>('Imagen', ImagenSchema);

export default Imagen;
