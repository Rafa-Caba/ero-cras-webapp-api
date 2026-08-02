// src/models/User.ts

import { Document, Schema, Types, model } from 'mongoose';
import type { UserRole } from '../types/roles.types';
import { USER_ROLES, isTenantRole } from '../types/roles.types';

export interface IUser extends Document<Types.ObjectId> {
    name: string;
    username: string;
    usernameNormalized: string;
    email: string;
    emailNormalized: string;
    password?: string;
    role: UserRole;

    imageUrl?: string;
    imagePublicId?: string | null;

    instrumentId?: Types.ObjectId | null;
    instrumentLabel?: string;
    voice?: boolean;
    bio?: string;

    themeId?: Types.ObjectId | null;
    pushToken?: string | null;

    choirId?: Types.ObjectId | null;

    isActive: boolean;
    mustChangePassword: boolean;
    passwordChangedAt?: Date | null;
    sessionVersion: number;
    platformAccountKey?: string;

    lastAccess?: Date | null;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const normalizeIdentifier = (value: string): string => {
    return value.trim().toLowerCase();
};

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        username: {
            type: String,
            required: true,
            trim: true
        },
        usernameNormalized: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        email: {
            type: String,
            required: true,
            trim: true
        },
        emailNormalized: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        password: {
            type: String,
            required: true,
            select: false
        },
        role: {
            type: String,
            enum: [...USER_ROLES],
            required: true
        },

        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },

        instrumentId: {
            type: Schema.Types.ObjectId,
            ref: 'Instrument',
            default: null
        },
        instrumentLabel: { type: String, default: '' },

        voice: { type: Boolean, default: false },
        bio: { type: String, default: '' },

        themeId: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
        pushToken: { type: String, default: null },

        choirId: { type: Schema.Types.ObjectId, ref: 'Choir', default: null },

        isActive: { type: Boolean, default: true },
        mustChangePassword: { type: Boolean, default: false },
        passwordChangedAt: { type: Date, default: null },
        sessionVersion: { type: Number, default: 1, min: 1 },
        platformAccountKey: { type: String },

        lastAccess: { type: Date, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

UserSchema.pre('validate', function normalizeAndValidateUser(this: IUser): void {
    this.usernameNormalized = normalizeIdentifier(this.username);
    this.emailNormalized = normalizeIdentifier(this.email);

    if (this.role === 'SUPER_ADMIN' && this.choirId) {
        this.invalidate(
            'choirId',
            'A SUPER_ADMIN platform account cannot belong to a choir'
        );
    }

    if (isTenantRole(this.role) && !this.choirId) {
        this.invalidate('choirId', 'Tenant users must belong to a choir');
    }
});

UserSchema.index(
    { choirId: 1, emailNormalized: 1 },
    {
        unique: true,
        partialFilterExpression: {
            choirId: { $type: 'objectId' }
        }
    }
);

UserSchema.index(
    { choirId: 1, usernameNormalized: 1 },
    {
        unique: true,
        partialFilterExpression: {
            choirId: { $type: 'objectId' }
        }
    }
);

UserSchema.index(
    { platformAccountKey: 1 },
    {
        unique: true,
        sparse: true
    }
);

UserSchema.index({ role: 1, isActive: 1 });

const User = model<IUser>('User', UserSchema);
export default User;
