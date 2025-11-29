import { Schema, model, Document, Types } from 'mongoose';

export interface IBlogComment {
    author: string; // Username string for simplicity or User ref
    text: any; // TipTap JSON
    date: Date;
}

export interface IBlogPost extends Document {
    title: string;
    content: any; // TipTap JSON
    imageUrl?: string;
    imagePublicId?: string;
    isPublic: boolean;
    
    author: string; // Storing username for display
    
    tags: string[];
    likes: number;
    likesUsers: string[]; // List of usernames or IDs
    comments: IBlogComment[];
    
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

const BlogCommentSchema = new Schema<IBlogComment>(
    {
        author: { type: String, required: true },
        text: { type: Schema.Types.Mixed, required: true },
        date: { type: Date, default: Date.now }
    },
    { _id: false }
);

const BlogPostSchema = new Schema<IBlogPost>(
    {
        title: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
        imageUrl: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },
        isPublic: { type: Boolean, default: false },
        
        author: { type: String, required: true }, // Username string
        
        tags: { type: [String], default: [] },
        likes: { type: Number, default: 0 },
        likesUsers: { type: [String], default: [] },
        comments: { type: [BlogCommentSchema], default: [] },
        
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
        
        // Manual population map for Author object if needed by UI
        if (ret.createdBy && typeof ret.createdBy === 'object') {
             ret.author = {
                id: ret.createdBy._id,
                name: ret.createdBy.name,
                username: ret.createdBy.username,
                imageUrl: ret.createdBy.imageUrl
             };
        } else {
             // Fallback if not populated
             ret.author = { name: ret.author, username: ret.author };
        }
    }
});

const BlogPost = model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;