// src/models/Theme.ts

import { Document, Schema, Types, model } from 'mongoose';

export interface ITheme extends Document<Types.ObjectId> {
    name: string;
    isDark: boolean;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    cardColor: string;
    buttonColor: string;
    navColor: string;
    buttonTextColor: string;
    secondaryTextColor: string;
    borderColor: string;
    choirId: Types.ObjectId;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        name: { type: String, required: true, trim: true },
        isDark: { type: Boolean, default: false },
        primaryColor: { type: String, required: true },
        accentColor: { type: String, required: true },
        backgroundColor: { type: String, required: true },
        textColor: { type: String, required: true },
        cardColor: { type: String, required: true },
        buttonColor: { type: String, required: true },
        navColor: { type: String, required: true },
        buttonTextColor: { type: String, default: '#ffffff' },
        secondaryTextColor: { type: String, default: '#6c757d' },
        borderColor: { type: String, default: '#dee2e6' },
        choirId: {
            type: Schema.Types.ObjectId,
            ref: 'Choir',
            required: true
        },
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

ThemeSchema.index(
    { choirId: 1, name: 1 },
    { unique: true, name: 'theme_choir_name_unique' }
);

const Theme = model<ITheme>('Theme', ThemeSchema);
export default Theme;
