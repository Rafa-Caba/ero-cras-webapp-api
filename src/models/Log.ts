import { Schema, model, Document, Types } from 'mongoose';

export interface ILog extends Document {
    accion: 'crear' | 'actualizar' | 'eliminar' | 'agregar_reaccion' | 'quitar_reaccion';
    coleccion: string; // por ejemplo: 'Aviso', 'Canto', etc.
    referenciaId: Types.ObjectId; // ID del documento afectado
    usuario: Types.ObjectId; // quién realizó la acción
    descripcion?: string;
    createdAt?: Date;
}

const LogSchema = new Schema<ILog>(
    {
        accion: {
            type: String,
            enum: ['crear', 'actualizar', 'eliminar', 'agregar_reaccion', 'quitar_reaccion'],
            required: true
        },
        coleccion: {
            type: String,
            required: true
        },
        referenciaId: {
            type: Schema.Types.ObjectId,
            required: true
        },
        usuario: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        descripcion: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false }, // Solo guardamos la fecha de creación
        versionKey: false
    }
);

const Log = model<ILog>('Log', LogSchema);

export default Log;
