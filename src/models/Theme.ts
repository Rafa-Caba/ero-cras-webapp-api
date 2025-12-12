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

    choirId?: Types.ObjectId | null;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt?: Date;
    updatedAt?: Date;
}

const ThemeSchema = new Schema<ITheme>(
    {
        name: { type: String, required: true },
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
            default: null,
            index: true
        },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true
    }
);

// Unique per choir (or global when choirId is null)
ThemeSchema.index({ name: 1, choirId: 1 }, { unique: true });

ThemeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;

        if (ret.choirId && typeof ret.choirId === 'object' && ret.choirId.toString) {
            ret.choirId = ret.choirId.toString();
        }

        return ret;
    }
});

const Theme = model<ITheme>('Theme', ThemeSchema);
export default Theme;
