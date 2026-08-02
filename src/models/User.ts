// src/models/User.ts

import { Document, Schema, Types, model } from 'mongoose';
import { assertSameChoirRelation } from '../services/tenantRelation.service';
import type { UserRole } from '../types/roles.types';
import { USER_ROLES, isTenantRole } from '../types/roles.types';
import Instrument from './Instrument';
import Theme from './Theme';

export interface IUser extends Document<Types.ObjectId> {
    name: string;
    username: string;
    usernameNormalized: string;
    email: string;
    emailNormalized: string;
    password: string;
    role: UserRole;
    imageUrl?: string;
    imagePublicId?: string | null;
    instrumentId?: Types.ObjectId | null;
    instrumentLabel?: string;
    voice: boolean;
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

export const normalizeUserIdentifier = (value: string): string => {
    return value.trim().toLowerCase();
};

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, trim: true },
        usernameNormalized: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        email: { type: String, required: true, trim: true },
        emailNormalized: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: [...USER_ROLES], required: true },
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
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            default: null,
            required: function requireChoirForTenantUser(this: IUser): boolean {
                return isTenantRole(this.role);
            }
        },
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

UserSchema.pre('validate', async function normalizeAndValidateUser(this: IUser): Promise<void> {
    this.usernameNormalized = normalizeUserIdentifier(this.username);
    this.emailNormalized = normalizeUserIdentifier(this.email);

    if (this.role === 'SUPER_ADMIN') {
        if (this.choirId) {
            this.invalidate(
                'choirId',
                'A SUPER_ADMIN platform account cannot belong to a choir'
            );
        }

        if (!this.platformAccountKey) {
            this.invalidate(
                'platformAccountKey',
                'A SUPER_ADMIN account requires a platform account key'
            );
        }

        if (this.instrumentId || this.themeId) {
            this.invalidate(
                'role',
                'A SUPER_ADMIN account cannot reference tenant resources'
            );
        }

        return;
    }

    if (!this.choirId) {
        this.invalidate('choirId', 'Tenant users must belong to a choir');
        return;
    }

    if (this.platformAccountKey) {
        this.invalidate(
            'platformAccountKey',
            'Tenant users cannot define a platform account key'
        );
    }

    await assertSameChoirRelation(
        Instrument,
        this.instrumentId,
        this.choirId,
        'instrumentId'
    );
    await assertSameChoirRelation(
        Theme,
        this.themeId,
        this.choirId,
        'themeId'
    );
});

UserSchema.index(
    { choirId: 1, emailNormalized: 1 },
    {
        unique: true,
        name: 'user_choir_email_unique',
        partialFilterExpression: { choirId: { $type: 'objectId' } }
    }
);
UserSchema.index(
    { choirId: 1, usernameNormalized: 1 },
    {
        unique: true,
        name: 'user_choir_username_unique',
        partialFilterExpression: { choirId: { $type: 'objectId' } }
    }
);
UserSchema.index(
    { emailNormalized: 1 },
    {
        unique: true,
        name: 'platform_user_email_unique',
        partialFilterExpression: { role: 'SUPER_ADMIN' }
    }
);
UserSchema.index(
    { usernameNormalized: 1 },
    {
        unique: true,
        name: 'platform_user_username_unique',
        partialFilterExpression: { role: 'SUPER_ADMIN' }
    }
);
UserSchema.index(
    { platformAccountKey: 1 },
    { unique: true, sparse: true, name: 'platform_account_key_unique' }
);
UserSchema.index({ choirId: 1, role: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });

const User = model<IUser>('User', UserSchema);
export default User;
