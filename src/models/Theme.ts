import { Schema, model, Document } from 'mongoose';

export interface ITheme extends Document {
    nombre: string;
    colorClass: string;
    color: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        nombre: { type: String, required: true },
        colorClass: { type: String, required: true },
        color: { type: String, required: true }
    },
    { timestamps: true }
);

const Theme = model<ITheme>('Theme', ThemeSchema);

export default Theme;
