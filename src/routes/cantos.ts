import express, { NextFunction, Request, Response } from 'express';
import verificarToken from '../middlewares/auth';
import Canto from '../models/Canto';
import { setActualizadoPor, setCreadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog } from '../utils/registrarLog';

const router = express.Router();

// Ruta pública: Obtener todos los cantos
router.get('/public', async (_req: Request, res: Response) => {
    try {
        const cantos = await Canto.find().sort({ createdAt: -1 });
        res.json(cantos);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Crear canto
router.post('/', verificarToken, setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, texto, tipo, compositor, fecha, url } = req.body;

        if (!titulo || !texto || Object.keys(texto).length === 0) {
            res.status(400).json({ mensaje: 'Título y texto son requeridos' });
            return;
        }

        const nuevoCanto = new Canto({
            titulo,
            texto,
            tipo,
            compositor,
            fecha,
            url,
            creadoPor: req.body.creadoPor
        });

        await nuevoCanto.save();

        if (!nuevoCanto._id) return;

        await registrarLog({
            req,
            coleccion: 'Cantos',
            accion: 'crear',
            referenciaId: nuevoCanto._id.toString(),
            cambios: { nuevo: nuevoCanto }
        });

        res.status(201).json(nuevoCanto);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Leer todos los cantos (privado con auth)
router.get('/', verificarToken, async (_req: Request, res: Response) => {
    try {
        const cantos = await applyPopulateAutores(Canto.find());
        res.json(cantos);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Obtener un canto por ID
router.get('/:id', verificarToken, async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
        const canto = await applyPopulateAutorSingle(Canto.findById(req.params.id));
        if (!canto) {
            res.status(404).json({ mensaje: 'Canto no encontrado' });
            return;
        }
        res.json(canto);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Actualizar canto
router.put('/:id', verificarToken, setActualizadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, texto, tipo, compositor, fecha, url } = req.body;

        if (!texto || Object.keys(texto).length === 0) {
            res.status(400).json({ mensaje: 'Texto inválido' });
            return;
        }

        const actualizado = await Canto.findByIdAndUpdate(
            req.params.id,
            {
                ...(titulo && { titulo }),
                ...(texto && { texto }),
                ...(tipo && { tipo }),
                ...(compositor && { compositor }),
                ...(fecha && { fecha }),
                ...(url && { url }),
                actualizadoPor: req.body.actualizadoPor
            },
            { new: true }
        );

        if (!actualizado?._id) return;

        await registrarLog({
            req,
            coleccion: 'Cantos',
            accion: 'actualizar',
            referenciaId: actualizado._id.toString(),
            cambios: { actualizado }
        });

        res.json(actualizado);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar canto
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const canto = await Canto.findById(req.params.id);

        if (!canto) {
            res.status(404).json({ mensaje: 'Canto no encontrado' });
            return;
        }

        await Canto.findByIdAndDelete(req.params.id);

        if (!canto._id) return;

        await registrarLog({
            req,
            coleccion: 'Cantos',
            accion: 'eliminar',
            referenciaId: canto._id.toString(),
            cambios: { eliminado: canto }
        });

        res.json({ mensaje: 'Canto eliminado' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;
