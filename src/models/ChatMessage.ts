import { Schema, model, Document, Types } from 'mongoose';
import type { JSONContent } from '@tiptap/react';

export interface IChatMessage extends Document {
    autor: Types.ObjectId;
    contenido: JSONContent;
    tipo: 'texto' | 'imagen' | 'archivo';
    archivoUrl?: string;
    archivoNombre?: string;
    imagenUrl?: string;
    imagenPublicId?: string;
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
            enum: ['texto', 'imagen', 'archivo'],
            default: 'texto'
        },
        archivoUrl: {
            type: String
        },
        archivoNombre: {
            type: String
        },
        imagenUrl: {
            type: String
        },
        imagenPublicId: {
            type: String
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
export default ChatMessage;
