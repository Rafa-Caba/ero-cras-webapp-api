import express, { Request, Response } from 'express';
import TipoCanto from '../models/TipoCanto';
import verificarToken from '../middlewares/auth';
import { setCreadoPor, setActualizadoPor } from '../utils/setCreadoPor';
import { registrarLog } from '../utils/registrarLog';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';

const router = express.Router();

// Ruta pública para obtener todos los tipos de canto (sin paginación)
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const tipos = await TipoCanto.find().sort({ orden: 1 });

        res.json({ tipos });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener los tipos públicos', error: err.message });
    }
});

// Ruta protegida para obtener todos los tipos (con o sin paginación)
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { all } = req.query;

        if (all === 'true') {
            const queryTipos = TipoCanto.find().sort({ orden: 1 });
            const tipos = await applyPopulateAutores(queryTipos);
            res.json({ tipos, totalTipos: tipos.length });
        } else {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 6;
            const skip = (page - 1) * limit;

            const totalTipos = await TipoCanto.countDocuments();
            const totalPaginas = Math.ceil(totalTipos / limit);

            const queryTipos = TipoCanto.find()
                .sort({ orden: 1 })
                .skip(skip)
                .limit(limit);

            const tipos = await applyPopulateAutores(queryTipos);

            res.json({
                tipos,
                paginaActual: page,
                totalPaginas
            });
        }
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener los tipos', error: err.message });
    }
});

// Obtener tipo por ID
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tipo = await applyPopulateAutorSingle(TipoCanto.findById(id));

        if (!tipo) {
            res.status(404).json({ msg: 'Tipo de canto no encontrado' });
            return;
        }
        res.json(tipo);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener el tipo', error: err.message });
    }
});

// Crear nuevo tipo de canto
router.post('/new', verificarToken, setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, orden } = req.body;

        const existente = await TipoCanto.findOne({ nombre });
        if (existente) {
            res.status(400).json({ msg: 'Ya existe un tipo con ese nombre.' });
            return;
        }

        const nuevo = new TipoCanto({ nombre, orden });
        await nuevo.save();

        if (!nuevo._id) return;

        await registrarLog({
            req,
            coleccion: 'TipoCantos',
            accion: 'crear',
            referenciaId: nuevo._id.toString(),
            cambios: { nuevo }
        });

        res.status(201).json(nuevo);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al crear tipo de canto', error: err.message });
    }
});

// Actualizar tipo por ID
router.put('/:id', verificarToken, setActualizadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { nombre, orden } = req.body;

        const existente = await TipoCanto.findOne({ nombre });

        if (existente && existente._id.toString() !== id) {
            res.status(400).json({ msg: 'Ya existe otro tipo de canto con ese nombre.' });
            return;
        }

        const actualizado = await TipoCanto.findByIdAndUpdate(
            id,
            { nombre, orden },
            { new: true }
        );

        if (!actualizado) {
            res.status(404).json({ msg: 'Tipo de canto no encontrado' });
            return;
        }

        if (!actualizado._id) return;

        await registrarLog({
            req,
            coleccion: 'TipoCantos',
            accion: 'actualizar',
            referenciaId: actualizado._id.toString(),
            cambios: { despues: actualizado }
        });

        res.json(actualizado);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al actualizar tipo de canto', error: err.message });
    }
});

// Eliminar tipo
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const tipo = await TipoCanto.findById(id);

        if (!tipo) {
            res.status(404).json({ msg: 'Tipo de canto no encontrado' });
            return;
        }

        await TipoCanto.findByIdAndDelete(id);

        if (!tipo._id) return;

        await registrarLog({
            req,
            coleccion: 'TipoCantos',
            accion: 'eliminar',
            referenciaId: tipo._id.toString(),
            cambios: { eliminado: tipo }
        });

        res.json({ msg: 'Tipo de canto eliminado' });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al eliminar tipo de canto', error: err.message });
    }
});

export default router;
