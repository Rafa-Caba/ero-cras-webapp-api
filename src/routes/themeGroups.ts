import express, { Request, Response } from 'express';
import ThemeGroup from '../models/ThemeGroup';
import verificarToken from '../middlewares/auth';
import { registrarLog } from '../utils/registrarLog';

const router = express.Router();

// Ruta pública para obtener todos los grupos de temas
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const grupos = await ThemeGroup.find();

        res.json({ grupos });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener grupos de temas públicos', error: err.message });
    }
});

router.get('/public/activo', async (req, res) => {
    try {
        const grupoActivo = await ThemeGroup.findOne({ activo: true });
        res.json(grupoActivo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener grupo activo', error });
    }
});

router.get('/public/tema-actual', async (req, res) => {
    try {
        const temaPublico = await ThemeGroup.findOne({ esTemaPublico: true });
        res.json(temaPublico);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener tema público actual', error });
    }
});

router.get('/activo', verificarToken, async (req, res) => {
    try {
        const grupoActivo = await ThemeGroup.findOne({ activo: true });
        res.json(grupoActivo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener grupo activo', error });
    }
});

// Obtener todos los grupos (paginados o todos)
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { all } = req.query;

        if (all === 'true') {
            const grupos = await ThemeGroup.find();
            res.json({ grupos, totalGrupos: grupos.length });
        } else {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 6;
            const skip = (page - 1) * limit;

            const totalGrupos = await ThemeGroup.countDocuments();
            const totalPaginas = Math.ceil(totalGrupos / limit);
            const grupos = await ThemeGroup.find().skip(skip).limit(limit);

            res.json({ grupos, paginaActual: page, totalPaginas });
        }
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener los grupos de temas', error: err.message });
    }
});

// Obtener uno por ID
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const grupo = await ThemeGroup.findById(req.params.id);
        if (!grupo) {
            res.status(404).json({ msg: 'Grupo de temas no encontrado' });
            return;
        }

        res.json(grupo);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al obtener grupo', error: err.message });
    }
});

// Crear nuevo grupo
router.post('/new', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, colores } = req.body;

        if (!Array.isArray(colores)) {
            res.status(400).json({ msg: 'El grupo debe tener colores.' });
            return;
        }

        const existente = await ThemeGroup.findOne({ nombre });
        if (existente) {
            res.status(400).json({ msg: 'Ya existe un grupo con ese nombre.' });
            return;
        }

        const nuevo = new ThemeGroup({ nombre, colores });
        await nuevo.save();

        if (!nuevo._id) return;

        await registrarLog({
            req,
            coleccion: 'ThemeGroups',
            accion: 'crear',
            referenciaId: nuevo._id.toString(),
            cambios: {
                nuevo: { nombre: nuevo.nombre, temas: nuevo.colores }
            }
        });

        res.status(201).json(nuevo);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al crear grupo', error: err.message });
    }
});

// Actualizar grupo
router.put('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, colores } = req.body;

        if (!Array.isArray(colores)) {
            res.status(400).json({ msg: 'El grupo debe contener colores.' });
            return;
        }

        const actualizado = await ThemeGroup.findByIdAndUpdate(
            req.params.id,
            { nombre, colores },
            { new: true }
        );

        if (!actualizado) {
            res.status(404).json({ msg: 'Grupo no encontrado' });
            return;
        }

        if (!actualizado._id) return;

        await registrarLog({
            req,
            coleccion: 'ThemeGroups',
            accion: 'actualizar',
            referenciaId: actualizado._id.toString(),
            cambios: {
                despues: { nombre: actualizado.nombre, temas: actualizado.colores }
            }
        });

        res.json(actualizado);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al actualizar grupo', error: err.message });
    }
});

// Activar Tema
router.put('/activar/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        await ThemeGroup.updateMany({}, { activo: false });

        const grupo = await ThemeGroup.findByIdAndUpdate(req.params.id, { activo: true }, { new: true });

        if (!grupo) {
            res.status(404).json({ msg: 'Grupo no encontrado para activar' });
            return;
        }

        res.json(grupo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al activar grupo de tema', error });
    }
});

// Marcar como público o privado
router.put('/publicar/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        // Desactivar todos los temas públicos actuales
        await ThemeGroup.updateMany({}, { esTemaPublico: false });

        // Activar solo el que viene por ID
        const grupo = await ThemeGroup.findByIdAndUpdate(
            req.params.id,
            { esTemaPublico: true },
            { new: true }
        );

        if (!grupo) {
            res.status(404).json({ msg: 'Grupo no encontrado para marcar como público' });
            return;
        }

        if (!grupo._id) return;

        await registrarLog({
            req,
            coleccion: 'ThemeGroups',
            accion: 'actualizar',
            referenciaId: grupo._id.toString(),
            cambios: { nuevoValor: grupo.nombre }
        });

        res.json(grupo);
    } catch (error: any) {
        res.status(500).json({ msg: 'Error al marcar tema como público', error: error.message });
    }
});
// Eliminar grupo
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const grupo = await ThemeGroup.findById(req.params.id);

        if (!grupo) {
            res.status(404).json({ msg: 'Grupo no encontrado' });
            return;
        }

        await ThemeGroup.findByIdAndDelete(req.params.id);

        if (!grupo._id) return;

        await registrarLog({
            req,
            coleccion: 'ThemeGroups',
            accion: 'eliminar',
            referenciaId: grupo._id.toString(),
            cambios: {
                eliminado: {
                    nombre: grupo.nombre,
                    temas: grupo.colores
                }
            }
        });

        res.json({ msg: 'Grupo de temas eliminado' });
    } catch (err: any) {
        res.status(500).json({ msg: 'Error al eliminar grupo', error: err.message });
    }
});

export default router;
