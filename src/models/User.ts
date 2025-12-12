import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
    name: string;
    username: string;
    email: string;
    password?: string;
    role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'USER' | 'SUPER_ADMIN';

    imageUrl?: string;
    imagePublicId?: string;

    instrumentId?: Types.ObjectId;
    instrumentLabel?: string;
    voice?: boolean;
    bio?: string;

    themeId?: Types.ObjectId;
    pushToken?: string;

    choirId?: Types.ObjectId;

    lastAccess?: Date;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ['ADMIN', 'EDITOR', 'VIEWER', 'USER', 'SUPER_ADMIN'],
            default: 'VIEWER',
            uppercase: true
        },

        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },

        instrumentId: { type: Schema.Types.ObjectId, ref: 'Choir', default: null },
        instrumentLabel: { type: String, default: '' },

        voice: { type: Boolean, default: false },
        bio: { type: String, default: '' },

        themeId: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
        pushToken: { type: String, default: null },

        choirId: { type: Schema.Types.ObjectId, ref: 'Choir', default: null },

        lastAccess: { type: Date, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc, ret: any) {
        if (ret._id) {
            ret.id = ret._id.toString();
            delete ret._id;
        }
        delete ret.password;
        return ret;
    }
});

const User = model<IUser>('User', UserSchema);
export default User;
