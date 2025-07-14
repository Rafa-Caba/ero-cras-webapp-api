// routes/avisos.ts
import express, { Request, Response } from 'express';
import cloudinary from '../utils/cloudinary';
import { uploadAvisoImage } from '../middlewares/cloudinaryStorage';
import verificarToken from '../middlewares/auth';
import Aviso from '../models/Aviso';
import { setActualizadoPor, setCreadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog } from '../utils/registrarLog';

const router = express.Router();

router.get('/buscar', verificarToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();
    if (!query) {
        res.status(400).json({ mensaje: 'Consulta vacía' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const avisos = await applyPopulateAutores(Aviso.find({ titulo: regex }));

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
            applyPopulateAutores(Aviso.find().sort({ createdAt: -1 }).skip(skip).limit(limit)),
            Aviso.countDocuments()
        ]);

        res.json({ avisos, paginaActual: pagina, totalPaginas: Math.ceil(total / limit), totalAvisos: total });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener avisos' });
    }
});

router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const aviso = await applyPopulateAutorSingle(Aviso.findById(req.params.id));

        if (!aviso) {
            res.status(404).json({ mensaje: 'Aviso no encontrado' });
            return;
        }

        res.json(aviso);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener aviso' });
    }
});

router.post('/', verificarToken, setCreadoPor, uploadAvisoImage.single('imagen'), async (req: Request, res: Response): Promise<void> => {
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

        if (!nuevoAviso._id) return;

        // Registrando en Logs
        await registrarLog({
            req,
            coleccion: 'Avisos',
            accion: 'crear',
            referenciaId: nuevoAviso._id.toString(),
            cambios: { nuevoAviso }
        });

        res.status(200).json({ mensaje: 'Aviso creado exitosamente', aviso: nuevoAviso });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear aviso' });
    }
});

router.put('/:id', verificarToken, setActualizadoPor, uploadAvisoImage.single('imagen'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { titulo, contenido, publicado } = req.body;

        const avisoAntes = await Aviso.findById(id);
        if (!avisoAntes) {
            res.status(404).json({ mensaje: 'Aviso no encontrado' });
            return;
        }

        // Si hay nueva imagen, borra la anterior de Cloudinary
        if (req.file && avisoAntes.imagenPublicId) {
            await cloudinary.uploader.destroy(avisoAntes.imagenPublicId);
        }

        // Modifica campos
        avisoAntes.titulo = titulo || avisoAntes.titulo;
        avisoAntes.contenido = contenido || avisoAntes.contenido;
        avisoAntes.publicado = publicado === 'true';

        if (req.file) {
            avisoAntes.imagenUrl = req.file.path;
            avisoAntes.imagenPublicId = req.file.filename;
        }

        await avisoAntes.save();

        if (!avisoAntes._id) return;

        // 📌 Registrar en logs
        await registrarLog({
            req,
            coleccion: 'Avisos',
            accion: 'actualizar',
            referenciaId: avisoAntes._id.toString(),
            cambios: {
                despues: avisoAntes // si quieres también puedes guardar "antes" clonando el original
            }
        });

        res.json(avisoAntes);
    } catch (error) {
        console.error('Error al actualizar aviso:', error);
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

        if (!aviso._id) return;

        // Registrar en log
        if (aviso) {
            await registrarLog({
                req,
                coleccion: 'Avisos',
                accion: 'eliminar',
                referenciaId: aviso._id.toString(),
                cambios: { eliminado: aviso }
            });
        }

        res.json({ mensaje: 'Aviso eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar aviso' });
    }
});

export default router;
