import { Schema, model, Document, Types } from 'mongoose';
import type { JSONContent } from '@tiptap/react';

export interface Comentario {
    autor: string;
    texto: JSONContent; // Tipado con TipTap
    fecha?: Date;
}

export interface IBlogPost extends Document {
    titulo: string;
    contenido: JSONContent;
    imagenUrl?: string;
    imagenPublicId?: string;
    autor: string;
    etiquetas: string[];
    likes: number;
    likesUsuarios: string[];
    comentarios: Comentario[];
    publicado: boolean;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const ComentarioSchema = new Schema<Comentario>(
    {
        autor: { type: String, required: true },
        texto: { type: Schema.Types.Mixed, required: true }, // TipTap content
        fecha: { type: Date, default: Date.now }
    },
    { _id: false }
);

const BlogPostSchema = new Schema<IBlogPost>(
    {
        titulo: { type: String, required: true },
        contenido: { type: Schema.Types.Mixed, required: true },
        imagenUrl: { type: String },
        imagenPublicId: { type: String },
        autor: { type: String, required: true },
        etiquetas: { type: [String], default: [] },
        likes: { type: Number, default: 0 },
        likesUsuarios: [{ type: String }],
        comentarios: [ComentarioSchema],
        publicado: { type: Boolean, default: false },
        creadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false
        },
        actualizadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false
        }
    },
    { timestamps: true }
);

const BlogPost = model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;
