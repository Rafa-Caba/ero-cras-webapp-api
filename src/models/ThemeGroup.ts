import { Schema, model, Document } from 'mongoose';

export interface ITheme {
    nombre: string;
    colorClass: string;
    color: string;
}

export interface IThemeGroup extends Document {
    nombre: string;
    descripcion?: string;
    colores: ITheme[];
    creadoPor?: string;
    actualizadoPor?: string;
    activo: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        nombre: { type: String, required: true },
        colorClass: { type: String, required: true },
        color: { type: String, required: true },
    },
    { _id: false } // importante para evitar _id anidado
);

const ThemeGroupSchema = new Schema<IThemeGroup>(
    {
        nombre: { type: String, required: true, unique: true },
        descripcion: { type: String },
        colores: { type: [ThemeSchema], required: true },
        creadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        actualizadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        activo: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const ThemeGroup = model<IThemeGroup>('ThemeGroup', ThemeGroupSchema);
export default ThemeGroup;
