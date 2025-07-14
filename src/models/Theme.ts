import { Schema, model, Document, Types } from 'mongoose';

export interface ITheme extends Document {
    nombre: string;
    colorClass: string;
    color: string;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        nombre: { type: String, required: true },
        colorClass: { type: String, required: true },
        color: { type: String, required: true },
        creadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false,
        },
        actualizadoPor: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: false
        }
    },
    { timestamps: true }
);

const Theme = model<ITheme>('Theme', ThemeSchema);

export default Theme;
