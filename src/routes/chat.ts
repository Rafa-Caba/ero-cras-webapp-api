import express, { Request, Response } from 'express';
import type { JSONContent } from '@tiptap/react';
import ChatMessage from '../models/ChatMessage';
import verificarToken from '../middlewares/auth';
import { setCreadoPor } from '../utils/setCreadoPor';
import { registrarLog } from '../utils/registrarLog';
import { streamUpload, uploadChatFile, uploadChatImage, uploadChatMedia } from '../middlewares/cloudinaryStorage';
import mongoose from 'mongoose';
import { TIPOS_MENSAJE_VALIDOS } from '../utils/constantes';
import { esExtensionMediaValida } from '../utils/validarMimeMedia';

const router = express.Router();

export interface RequestConUsuario extends Request {
    usuario?: {
        id: string;
        nombre: string;
        username: string;
        rol: string;
    };
}

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

        if (!TIPOS_MENSAJE_VALIDOS.includes(tipo)) {
            res.status(400).json({ mensaje: 'Tipo de mensaje no válido' });
            return;
        }

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

// Subir Imagen del Chat
router.post('/upload-image', verificarToken, uploadChatImage.single('imagen'), setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { contenido, autor } = req.body;

        if (!req.file) {
            res.status(400).json({ mensaje: 'No se recibió ninguna imagen' });
            return;
        }

        const tipo = 'imagen';

        if (!TIPOS_MENSAJE_VALIDOS.includes(tipo)) {
            res.status(400).json({ mensaje: 'Tipo de mensaje no válido' });
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

// PATCH: Agregar o quitar reacción
router.patch('/:id/reaccion', verificarToken, async (req: RequestConUsuario, res: Response): Promise<void> => {
    try {
        const mensajeId = req.params.id;
        const { emoji } = req.body;
        const usuarioId = req.usuario?.id;

        const mensaje = await ChatMessage.findById(mensajeId);
        if (!mensaje) {
            res.status(404).json({ mensaje: 'Mensaje no encontrado' });
            return;
        }

        if (!usuarioId) return;

        // Verificar si ya reaccionó con ese emoji
        const yaReacciono = mensaje.reacciones?.some(r =>
            r.usuario.toString() === usuarioId.toString() && r.emoji === emoji
        );

        if (yaReacciono) {
            // Quitar reacción si ya estaba puesta
            mensaje.reacciones = mensaje.reacciones?.filter(r =>
                !(r.usuario.toString() === usuarioId.toString() && r.emoji === emoji)
            );
        } else {
            // Agregar reacción nueva
            mensaje.reacciones = [
                ...(mensaje.reacciones || []),
                { emoji, usuario: new mongoose.Types.ObjectId(usuarioId) }
            ];
        }

        await mensaje.save();
        await mensaje.populate('autor', 'nombre username fotoPerfilUrl');

        if (!mensaje._id) return;

        await registrarLog({
            req,
            coleccion: 'ChatMessage',
            accion: yaReacciono ? 'quitar_reaccion' : 'agregar_reaccion',
            referenciaId: mensaje._id.toString(),
            cambios: {
                emoji,
                usuario: usuarioId
            }
        });

        // Emitir actualización del mensaje
        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('mensaje-actualizado', mensaje);
        }

        res.json({ mensaje });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar reacciones', error });
    }
});

// Subir File del Chat
// router.post('/upload-file', verificarToken, uploadChatFile.single('archivo'), setCreadoPor, async (req: RequestConUsuario, res: Response): Promise<void> => {
//     try {
//         const { autor } = req.body;

//         if (!req.file) {
//             res.status(400).json({ mensaje: 'No se recibió ningún archivo' });
//             return;
//         }

//         console.log({
//             file: req.file
//         });

//         const tipo = 'archivo';

//         if (!TIPOS_MENSAJE_VALIDOS.includes(tipo)) {
//             res.status(400).json({ mensaje: 'Tipo de mensaje no válido' });
//             return;
//         }

//         const mensaje = new ChatMessage({
//             autor,
//             contenido: {}, // No se usa en archivos
//             tipo: 'archivo',
//             archivoUrl: req.file?.path || '',
//             archivoNombre: req.file?.originalname || '',
//             creadoPor: req.body.creadoPor,
//         });

//         console.log({
//             ...mensaje
//         });

//         await mensaje.save();
//         await mensaje.populate('autor', 'nombre username fotoPerfilUrl');

//         if (!mensaje._id) return;

//         await registrarLog({
//             req,
//             coleccion: 'ChatMessage',
//             accion: 'crear',
//             referenciaId: mensaje._id.toString(),
//             cambios: { nuevo: mensaje }
//         });

//         if (req.app.get('io')) {
//             const io = req.app.get('io');
//             io.emit('nuevo-mensaje', mensaje);
//         }

//         res.status(201).json({ mensaje });
//     } catch (error: any) {
//         console.error('[Error al subir archivo]', error?.message || error);
//         res.status(500).json({ mensaje: 'Error al subir archivo' });
//     }
// });
router.post('/upload-file', verificarToken, uploadChatFile.single('archivo'), setCreadoPor, async (req: RequestConUsuario, res: Response): Promise<void> => {
    try {
        const { autor } = req.body;

        if (!req.file) {
            res.status(400).json({ mensaje: 'No se recibió ningún archivo' });
            return;
        }

        const resultado = await streamUpload(req.file.buffer, req.file.originalname, 'auto');

        const mensaje = new ChatMessage({
            autor,
            contenido: {},
            tipo: 'archivo',
            archivoUrl: resultado.secure_url,
            archivoNombre: req.file.originalname,
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
            cambios: { nuevo: mensaje },
        });

        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('nuevo-mensaje', mensaje);
        }

        res.status(201).json({ mensaje });
    } catch (error: any) {
        console.error('[Error al subir archivo]', error.message || error);
        res.status(500).json({ mensaje: 'Error interno al subir archivo', error: error.message });
    }
}
);


// Subir Media del Chat
router.post('/upload-media', verificarToken, uploadChatMedia.single('media'), setCreadoPor, async (req: RequestConUsuario, res: Response): Promise<void> => {
    try {
        const { autor } = req.body;

        if (!req.file) {
            res.status(400).json({ mensaje: 'No se recibió ningún archivo de media' });
            return;
        }

        if (!esExtensionMediaValida(req.file.originalname)) {
            res.status(400).json({ mensaje: 'Extensión de archivo no permitida' });
            return;
        }

        const tipo = 'media';

        const mensaje = new ChatMessage({
            autor,
            contenido: {},
            tipo,
            archivoUrl: req.file?.path || '',
            archivoNombre: req.file?.originalname || '',
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

        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('nuevo-mensaje', mensaje);
        }

        res.status(201).json({ mensaje });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al subir archivo de media', error });
    }
});

export default router;
