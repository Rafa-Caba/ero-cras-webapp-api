// models/TipoCanto.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface ITipoCanto extends Document {
    _id: Types.ObjectId;
    nombre: string;
    orden: number;
    creadoPor?: Types.ObjectId;
    actualizadoPor?: Types.ObjectId;
}

const TipoCantoSchema = new Schema<ITipoCanto>({
    nombre: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    orden: {
        type: Number,
        default: 99
    },
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
}, {
    timestamps: true
});

const TipoCanto = model<ITipoCanto>('TipoCanto', TipoCantoSchema);
export default TipoCanto;
