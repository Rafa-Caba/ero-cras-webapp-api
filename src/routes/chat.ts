import express, { Request, Response } from 'express';
import type { JSONContent } from '@tiptap/react';
import ChatMessage from '../models/ChatMessage';
import verificarToken from '../middlewares/auth';
import { setCreadoPor } from '../utils/setCreadoPor';
import { registrarLog } from '../utils/registrarLog';
import { uploadChatImage } from '../middlewares/cloudinaryStorage';

const router = express.Router();

// Obtener últimos mensajes (limitados a 50)
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = 50, before } = req.query;

        const query: any = {};
        if (before) {
            query.createdAt = { $lt: new Date(before as string) };
        }

        const mensajes = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .populate('autor', 'nombre username fotoPerfilUrl');

        res.json(mensajes.reverse());
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener mensajes', error });
    }
});

// Crear mensaje nuevo
router.post('/', verificarToken, setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { autor, contenido, tipo, archivoUrl, archivoNombre } = req.body;

        // console.log('🔐 Token recibido:', req.headers.authorization);

        const mensaje = new ChatMessage({
            autor,
            contenido,
            tipo,
            archivoUrl,
            archivoNombre,
            creadoPor: req.body.creadoPor
        });

        await mensaje.save();

        await mensaje.populate('autor', 'nombre username fotoPerfilUrl');

        if (!mensaje._id) return;

        await registrarLog({
            req,
            coleccion: 'ChatMessage',
            accion: 'crear',
            referenciaId: mensaje._id.toString(),
            cambios: { nuevo: mensaje }
        });

        // Emitir mensaje por socket si `io` está disponible en otro archivo
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('nuevo-mensaje', mensaje);
        }

        res.status(201).json({ mensaje });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear el mensaje', error });
    }
});

router.post('/upload-image', verificarToken, uploadChatImage.single('imagen'), setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { contenido, autor } = req.body;

        if (!req.file) {
            res.status(400).json({ mensaje: 'No se recibió ninguna imagen' });
            return;
        }

        const mensaje = new ChatMessage({
            autor,
            contenido: contenido ? JSON.parse(contenido) : {},
            tipo: 'imagen',
            imagenUrl: req.file?.path || '',
            imagenPublicId: req.file?.filename || '',
            creadoPor: req.body.creadoPor,
        });

        await mensaje.save();
        await mensaje.populate('autor', 'nombre username fotoPerfilUrl');

        if (!mensaje._id) return;

        await registrarLog({
            req,
            coleccion: 'ChatMessage',
            accion: 'crear',
            referenciaId: mensaje._id.toString(),
            cambios: { nuevo: mensaje }
        });

        // Emitir a socket
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('nuevo-mensaje', mensaje);
        }

        res.status(201).json({ mensaje });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error al subir imagen del chat', error });
    }
});

export default router;
