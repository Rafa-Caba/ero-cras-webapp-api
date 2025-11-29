import { Schema, model, Document, Types } from 'mongoose';

export interface ITheme {
    nombre: string;
    colorClass: string;
    color: string;
}

export interface IThemeGroup extends Document {
    nombre: string;
    descripcion?: string;
    colores: ITheme[];
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
    activo: boolean;
    esTemaPublico: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        nombre: { type: String, required: true },
        colorClass: { type: String, required: true },
        color: { type: String, required: true },
    },
    { _id: false } 
);

const ThemeGroupSchema = new Schema<IThemeGroup>(
    {
        nombre: { type: String, required: true, unique: true },
        descripcion: { type: String },
        colores: { type: [ThemeSchema], required: true },
        creadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        actualizadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        activo: { type: Boolean, default: false },
        esTemaPublico: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// 🟣 TRANSFORM FOR MOBILE APP
ThemeGroupSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        
        ret.name = ret.nombre;
        ret.isDark = ret.nombre.toLowerCase().includes('dark') || ret.nombre.toLowerCase().includes('oscuro');

        // Defaults
        ret.primaryColor = '#000000';
        ret.accentColor = '#666666';
        ret.backgroundColor = '#FFFFFF';
        ret.textColor = '#000000';
        ret.cardColor = '#F0F0F0';
        ret.buttonColor = '#000000';
        ret.navColor = '#FFFFFF';

        if (Array.isArray(ret.colores)) {
            ret.colores.forEach((c: ITheme) => {
                const key = c.colorClass.toLowerCase();
                
                // STRICTER MAPPING to avoid overlaps
                if (key === 'primary' || key === 'principal') ret.primaryColor = c.color;
                else if (key === 'accent' || key === 'secundario') ret.accentColor = c.color;
                else if (key === 'background' || key === 'fondo') ret.backgroundColor = c.color;
                
                // Specific Text types
                else if (key === 'text' || key === 'texto') ret.textColor = c.color;
                else if (key === 'secondarytext' || key === 'textosecundario') ret.secondaryTextColor = c.color;
                else if (key === 'buttontext' || key === 'textoboton') ret.buttonTextColor = c.color;
                
                else if (key === 'card' || key === 'tarjeta') ret.cardColor = c.color;
                else if (key === 'button' || key === 'boton') ret.buttonColor = c.color;
                else if (key === 'nav' || key === 'menu') ret.navColor = c.color;
                else if (key.includes('border')) ret.borderColor = c.color;
            });
        }
        
        delete ret.colores;
    }
});

const ThemeGroup = model<IThemeGroup>('ThemeGroup', ThemeGroupSchema);
export default ThemeGroup;