import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
    name: string;
    username: string;
    email: string;
    password?: string; // Stored hash
    role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'USER';
    
    imageUrl?: string;
    imagePublicId?: string; // For Cloudinary management
    
    instrument?: string;
    voice?: boolean;
    bio?: string;
    
    themeId?: Types.ObjectId;
    pushToken?: string;
    
    lastAccess?: Date;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['ADMIN', 'EDITOR', 'VIEWER'], default: 'VIEWER', uppercase: true },
        
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: null },
        
        instrument: { type: String, default: '' },
        voice: { type: Boolean, default: false },
        bio: { type: String, default: '' },
        
        themeId: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
        pushToken: { type: String, default: null },
        
        lastAccess: { type: Date, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

// Minimal Transform: Just ID mapping
UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
    }
});

const User = model<IUser>('User', UserSchema);
export default User;