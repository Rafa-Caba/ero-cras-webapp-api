import express, { NextFunction, Request, Response } from 'express';
import verificarToken from '../middlewares/auth';
import Canto from '../models/Canto';

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
router.post('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const nuevoCanto = new Canto(req.body);
        await nuevoCanto.save();
        res.status(201).json(nuevoCanto);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Leer todos los cantos
router.get('/', verificarToken, async (_req: Request, res: Response) => {
    try {
        const cantos = await Canto.find();
        res.json(cantos);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Obtener un canto por ID
router.get('/:id', verificarToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const canto = await Canto.findById(req.params.id);
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
router.put('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const actualizado = await Canto.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(actualizado);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar canto
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        await Canto.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Canto eliminado' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;
