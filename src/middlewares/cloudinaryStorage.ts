import { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

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
