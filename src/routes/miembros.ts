import express, { Request, Response } from 'express';
import cloudinary from '../utils/cloudinary';
import { uploadMiembroImage } from '../middlewares/cloudinaryStorage';

import verificarToken from '../middlewares/auth';
import Miembro from '../models/Miembro';

const router = express.Router();

// Buscar miembros
router.get('/buscar', verificarToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();

    if (!query) {
        res.status(400).json({ mensaje: 'Consulta vacía' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const miembros = await Miembro.find({
            $or: [
                { nombre: regex },
                { instrumento: regex }
            ]
        }).select('nombre instrumento tieneVoz fotoPerfilUrl');

        res.json(miembros);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la búsqueda' });
    }
});

// Obtener miembros con paginación
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const pagina = parseInt(req.query.page as string) || 1;
        const limite = parseInt(req.query.limit as string) || 5;
        const skip = (pagina - 1) * limite;

        const [miembros, total] = await Promise.all([
            Miembro.find()
                .sort({ nombre: 1 })
                .skip(skip)
                .limit(limite)
                .select('nombre instrumento tieneVoz fotoPerfilUrl'),
            Miembro.countDocuments()
        ]);

        res.json({
            miembros,
            paginaActual: pagina,
            totalPaginas: Math.ceil(total / limite),
            totalMiembros: total
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener los miembros' });
    }
});

// Obtener un miembro por ID
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const miembro = await Miembro.findById(req.params.id)
            .select('nombre instrumento tieneVoz fotoPerfilUrl');

        if (!miembro) {
            res.status(404).json({ mensaje: 'Miembro no encontrado' });
            return;
        }

        res.json(miembro);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Crear nuevo miembro
router.post('/', verificarToken, uploadMiembroImage.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, instrumento, tieneVoz } = req.body;

        if (!nombre || !instrumento) {
            res.status(400).json({ mensaje: 'Nombre e instrumento son obligatorios' });
            return;
        }

        const nuevoMiembro = new Miembro({
            nombre,
            instrumento,
            tieneVoz: tieneVoz === 'true',
            fotoPerfilUrl: req.file?.path || '',
            fotoPerfilPublicId: req.file?.filename || ''
        });

        await nuevoMiembro.save();

        res.status(200).json({
            mensaje: 'Miembro creado exitosamente',
            miembro: nuevoMiembro
        });
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Actualizar miembro
router.put('/:id', verificarToken, uploadMiembroImage.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, instrumento, tieneVoz } = req.body;
        const miembro = await Miembro.findById(req.params.id);

        if (!miembro) {
            res.status(404).json({ mensaje: 'Miembro no encontrado' });
            return;
        }

        // Si hay nueva imagen, elimina la anterior
        if (req.file && miembro.fotoPerfilPublicId) {
            await cloudinary.uploader.destroy(miembro.fotoPerfilPublicId);
        }

        const updateFields: Record<string, any> = {
            ...(nombre && { nombre }),
            ...(instrumento && { instrumento }),
            ...(typeof tieneVoz !== 'undefined' && { tieneVoz: tieneVoz === 'true' }),
        };

        if (req.file) {
            updateFields.fotoPerfilUrl = req.file.path;
            updateFields.fotoPerfilPublicId = req.file.filename;
        }

        const actualizado = await Miembro.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );

        res.json(actualizado);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar miembro
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const miembro = await Miembro.findById(req.params.id);

        if (!miembro) {
            res.status(404).json({ mensaje: 'Miembro no encontrado' });
            return;
        }

        if (miembro.fotoPerfilPublicId) {
            await cloudinary.uploader.destroy(miembro.fotoPerfilPublicId);
        }

        await Miembro.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Miembro eliminado correctamente' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;
