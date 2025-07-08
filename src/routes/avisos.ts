// routes/avisos.ts
import express, { Request, Response } from 'express';
import cloudinary from '../utils/cloudinary';
import { uploadAvisoImage } from '../middlewares/cloudinaryStorage';
import verificarToken from '../middlewares/auth';
import Aviso from '../models/Aviso';

const router = express.Router();

router.get('/buscar', verificarToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();
    if (!query) {
        res.status(400).json({ mensaje: 'Consulta vacía' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const avisos = await Aviso.find({ titulo: regex });
        res.json(avisos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la búsqueda' });
    }
});

router.get('/', verificarToken, async (req: Request, res: Response) => {
    try {
        const pagina = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (pagina - 1) * limit;

        const [avisos, total] = await Promise.all([
            Aviso.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
            Aviso.countDocuments()
        ]);

        res.json({ avisos, paginaActual: pagina, totalPaginas: Math.ceil(total / limit), totalAvisos: total });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener avisos' });
    }
});

router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const aviso = await Aviso.findById(req.params.id);
        if (!aviso) {
            res.status(404).json({ mensaje: 'Aviso no encontrado' });
            return;
        }

        res.json(aviso);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener aviso' });
    }
});

router.post('/', verificarToken, uploadAvisoImage.single('imagen'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, contenido, publicado } = req.body;

        if (!titulo || !contenido) {
            res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
            return;
        }

        const nuevoAviso = new Aviso({
            titulo,
            contenido,
            publicado: publicado === 'true',
            imagenUrl: req.file?.path || '',
            imagenPublicId: req.file?.filename || null
        });

        await nuevoAviso.save();
        res.status(200).json({ mensaje: 'Aviso creado exitosamente', aviso: nuevoAviso });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear aviso' });
    }
});

router.put('/:id', verificarToken, uploadAvisoImage.single('imagen'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, contenido, publicado } = req.body;
        const aviso = await Aviso.findById(req.params.id);
        if (!aviso) {
            res.status(404).json({ mensaje: 'Aviso no encontrado' });
            return;
        }

        if (req.file && aviso.imagenPublicId) {
            await cloudinary.uploader.destroy(aviso.imagenPublicId);
        }

        aviso.titulo = titulo || aviso.titulo;
        aviso.contenido = contenido || aviso.contenido;
        aviso.publicado = publicado === 'true';
        if (req.file) {
            aviso.imagenUrl = req.file.path;
            aviso.imagenPublicId = req.file.filename;
        }

        await aviso.save();
        res.json(aviso);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar aviso' });
    }
});

router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const aviso = await Aviso.findById(req.params.id);
        if (!aviso) {
            res.status(404).json({ mensaje: 'Aviso no encontrado' });
            return;
        }

        if (aviso.imagenPublicId) {
            await cloudinary.uploader.destroy(aviso.imagenPublicId);
        }

        await Aviso.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Aviso eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar aviso' });
    }
});

export default router;
