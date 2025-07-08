import { Schema, model, Document } from 'mongoose';

export interface Comentario {
    autor: string;
    texto: string;
    fecha?: Date;
}

export interface IBlogPost extends Document {
    titulo: string;
    contenido: string;
    imagenUrl?: string;
    imagenPublicId?: string;
    autor: string;
    etiquetas: string[];
    likes: number;
    likesUsuarios: string[];
    comentarios: Comentario[];
    publicado: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
    {
        titulo: { type: String, required: true },
        contenido: { type: String, required: true },
        imagenUrl: { type: String },
        imagenPublicId: { type: String },
        autor: { type: String, required: true },
        etiquetas: { type: [String], default: [] },
        likes: { type: Number, default: 0 },
        likesUsuarios: [{ type: String }],
        comentarios: [
            {
                autor: { type: String, required: true },
                texto: { type: String, required: true },
                fecha: { type: Date, default: Date.now }
            }
        ],
        publicado: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const BlogPost = model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;
