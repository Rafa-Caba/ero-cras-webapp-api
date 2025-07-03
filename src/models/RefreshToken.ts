import { Schema, model, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
    token: string;
    userId: Types.ObjectId;
    createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
    {
        token: {
            type: String,
            required: true,
            unique: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: '7d' // Token expira automáticamente en 7 días
        }
    },
    {
        timestamps: false // No usamos updatedAt/createdAt automáticos aquí
    }
);

const RefreshToken = model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

export default RefreshToken;
