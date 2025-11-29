declare module 'multer-storage-cloudinary' {
    import { v2 as cloudinary } from 'cloudinary';
    import { StorageEngine } from 'multer';

    interface Options {
        cloudinary: typeof cloudinary;
        params?: {
            folder?: string;
            format?: string;
            public_id?: (req: any, file: any) => string;
            resource_type?: string;
            allowed_formats?: string[];
            transformation?: any;
        } | ((req: any, file: any) => any);
    }

    export class CloudinaryStorage implements StorageEngine {
        constructor(options: Options);
        _handleFile(req: any, file: any, cb: any): void;
        _removeFile(req: any, file: any, cb: any): void;
    }
}