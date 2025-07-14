// routes/logs.ts
import express, { Request, Response } from 'express';
import verificarToken from '../middlewares/auth';
import Log from '../models/Log';

const router = express.Router();

// Obtener logs con paginación y filtros
router.get('/', verificarToken, async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, coleccion, accion, usuarioId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filtros: any = {};

        if (coleccion) filtros.coleccion = coleccion;
        if (accion) filtros.accion = accion;
        if (usuarioId) filtros.usuario = usuarioId;

        const [logs, total] = await Promise.all([
            Log.find(filtros)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('usuario', 'nombre username rol'),
            Log.countDocuments(filtros),
        ]);

        const totalPaginas = Math.ceil(total / Number(limit));

        res.json({
            logs,
            paginaActual: Number(page),
            totalPaginas,
            totalLogs: total,
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener logs', error });
    }
});

// Obtener logs por usuario
router.get('/usuario/:usuarioId', verificarToken, async (req: Request, res: Response) => {
    try {
        const { usuarioId } = req.params;
        const pagina = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 6;
        const skip = (pagina - 1) * limit;

        const [logs, totalLogs] = await Promise.all([
            Log.find({ usuario: usuarioId })
                .populate('usuario', 'nombre username rol')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Log.countDocuments({ usuario: usuarioId })
        ]);

        const totalPaginas = Math.ceil(totalLogs / limit);

        res.json({
            logs,
            paginaActual: pagina,
            totalPaginas
        });
    } catch (err: any) {
        res.status(500).json({ mensaje: 'Error al obtener logs del usuario', error: err.message });
    }
});

export default router;
