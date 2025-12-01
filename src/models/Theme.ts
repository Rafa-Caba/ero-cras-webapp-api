import { Schema, model, Document, Types } from 'mongoose';

export interface ITheme extends Document {
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

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const ThemeSchema = new Schema<ITheme>({
    name: { type: String, required: true, unique: true },
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

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

ThemeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
    }
});

const Theme = model<ITheme>('Theme', ThemeSchema);
export default Theme;