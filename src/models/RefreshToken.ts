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
            ref: 'User',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: '7d'
        }
    },
    {
        timestamps: false
    }
);

RefreshTokenSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret: any) {
        if (ret._id) {
            ret.id = ret._id.toString();
            delete ret._id;
        }
        return ret;
    }
});

const RefreshToken = model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
export default RefreshToken;
