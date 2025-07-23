import { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { Readable } from 'stream';

// 🟢 Upload para Usuarios
export const uploadUserImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/usuarios',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `usuario_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});

// 🟣 Upload para Galería
export const uploadGalleryImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/galeria',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `galeria_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});

// 🆕 Upload para miembros
export const uploadMiembroImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/miembros',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `miembro_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});

// 🆕 Upload para blog posts
export const uploadBlogImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/blogposts',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `post_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});

// 🆕 Upload para avisos
export const uploadAvisoImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/avisos',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `aviso_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});

// 🆕 Upload para chats
export const uploadChatImage = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-imagenes/chats',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `chat_${nombre}_${timestamp}`;
            },
            transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        } as any
    })
});


// 🆕 Upload para Media en Chats 
export const uploadChatMedia = multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'ero-cras-archivos/chats/media',
            resource_type: 'video',
            allowed_formats: ['mp3', 'wav', 'mp4', 'mov', 'webm'],
            public_id: (req: Request, file: Express.Multer.File): string => {
                const nombre = file.originalname.split('.')[0];
                const timestamp = Date.now();
                return `media_${nombre}_${timestamp}`;
            }
        } as any
    })
});


// 🆕 Upload para Files en Chats
const storage = multer.memoryStorage();
export const uploadChatFile = multer({ storage });

export const streamUpload = (buffer: Buffer, originalName: string, resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto'): Promise<any> => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();

        // Separa nombre y extensión correctamente
        const partes = originalName.split('.');
        const extension = partes.pop(); // quita y guarda la extensión
        const nombreBase = partes.join('.');

        // Crea el nombre con timestamp ANTES de la extensión
        const nombreFinal = `archivo_${nombreBase}_${timestamp}.${extension}`;

        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: 'ero-cras-archivos/chats/files',
                public_id: nombreFinal,
                use_filename: false,
                unique_filename: false
            },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );

        Readable.from(buffer).pipe(stream);
    });
};


