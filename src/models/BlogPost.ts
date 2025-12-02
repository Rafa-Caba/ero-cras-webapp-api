import { Schema, model, Document, Types } from 'mongoose';

export interface IBlogPost extends Document {
    title: string;
    content: any;
    imageUrl?: string;
    imagePublicId?: string;
    isPublic: boolean;

    author: Types.ObjectId;

    // Likes & Comments
    likes: number;
    likesUsers: Types.ObjectId[];
    comments: Array<{
        author: string;
        text: any;
        date: Date;
    }>;

    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
    {
        title: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },
        isPublic: { type: Boolean, default: false },

        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        likes: { type: Number, default: 0 },
        likesUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        comments: [{
            author: String,
            text: Schema.Types.Mixed,
            date: { type: Date, default: Date.now }
        }],

        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

BlogPostSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
    }
});

const BlogPost = model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;