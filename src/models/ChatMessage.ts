import { Schema, model, Document, Types } from 'mongoose';
import type { JSONContent } from '@tiptap/react';

export interface IChatMessage extends Document {
    autor: Types.ObjectId;
    contenido: JSONContent;
    tipo: 'texto' | 'imagen' | 'archivo' | 'media' | 'reaccion';
    archivoUrl?: string;
    archivoNombre?: string;
    imagenUrl?: string;
    imagenPublicId?: string;
    reacciones?: {
        emoji: string;
        usuario: Types.ObjectId;
    }[];
    createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        autor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        contenido: {
            type: Schema.Types.Mixed,
            required: true
        },
        tipo: {
            type: String,
            enum: ['texto', 'imagen', 'archivo', 'media', 'reaccion'],
            default: 'texto'
        },
        archivoUrl: String,
        archivoNombre: String,
        imagenUrl: String,
        imagenPublicId: String,

        reacciones: [
            {
                emoji: { type: String, required: true },
                usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }
            }
        ]
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;
