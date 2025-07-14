import express, { Request, Response } from 'express';
import Theme from '../models/Theme';
import verificarToken from '../middlewares/auth';
import { setActualizadoPor, setCreadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog } from '../utils/registrarLog';

const router = express.Router();

// Ruta pública para obtener todos los temas sin paginación
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const temas = await Theme.find().sort({ createdAt: -1 });
        res.json({ temas });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener los temas públicos', error: err.message });
    }
});

// Obtener todos los colores del tema (con o sin paginación)
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { all } = req.query;

        if (all === 'true') {
            const temas = await Theme.find();
            res.json({ temas, totalTemas: temas.length });
        } else {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 6;
            const skip = (page - 1) * limit;

            const totalTemas = await Theme.countDocuments();
            const totalPaginas = Math.ceil(totalTemas / limit);

            const query = Theme.find().skip(skip).limit(limit);
            const temas = await applyPopulateAutores(query);

            res.json({
                temas,
                paginaActual: page,
                totalPaginas
            });
        }
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener los temas', error: err.message });
    }
});

// Obtener una clase de color por ID
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const color = await applyPopulateAutorSingle(Theme.findById(id));

        if (!color) {
            res.status(404).json({ msg: 'Clase de color no encontrada' });
            return;
        }
        res.json(color);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener clase de color', error: err.message });
    }
});

// Actualizar una clase de color por ID
router.put('/:id', verificarToken, setActualizadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nombre, colorClass, color } = req.body;

        const actualizado = await Theme.findByIdAndUpdate(
            id,
            { nombre, colorClass, color },
            { new: true }
        );

        if (!actualizado) {
            res.status(404).json({ msg: 'Clase de color no encontrada' });
            return;
        }

        if (!actualizado._id) return;

        await registrarLog({
            req,
            coleccion: 'Themes',
            accion: 'actualizar',
            referenciaId: actualizado._id.toString(),
            cambios: {
                despues: actualizado
            }
        });

        res.json(actualizado);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al actualizar clase de color', error: err.message });
    }
});

// Crear una nueva clase de color
router.post('/new', verificarToken, setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, color, colorClass } = req.body;
        const existente = await Theme.findOne({ colorClass });
        if (existente) {
            res.status(400).json({ msg: 'Ya existe esa clase de color.' });
            return;
        }

        const nuevoTheme = new Theme({ nombre, color, colorClass });
        await nuevoTheme.save();

        if (!nuevoTheme._id) return;

        await registrarLog({
            req,
            coleccion: 'Themes',
            accion: 'crear',
            referenciaId: nuevoTheme._id.toString(),
            cambios: { nuevo: nuevoTheme }
        });

        res.status(201).json(nuevoTheme);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al crear clase de color', error: err.message });
    }
});

// Eliminar una clase de color
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const theme = await Theme.findById(id);

        if (!theme) {
            res.status(404).json({ mensaje: 'Tema no encontrado' });
            return;
        }

        await Theme.findByIdAndDelete(id);

        if (!theme._id) return;

        await registrarLog({
            req,
            coleccion: 'Themes',
            accion: 'eliminar',
            referenciaId: theme._id.toString(),
            cambios: { eliminado: theme }
        });

        res.json({ msg: 'Color eliminado' });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al eliminar clase de color', error: err.message });
    }
});

export default router;
