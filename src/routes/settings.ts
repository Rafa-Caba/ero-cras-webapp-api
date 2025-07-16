import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Settings, { ISetting } from '../models/Settings';
import verificarToken from '../middlewares/auth';
import { setActualizadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog, RequestConUsuario } from '../utils/registrarLog';

const router = express.Router();

// Obtener configuración públicamente
router.get('/public', async (_req: Request, res: Response) => {
    try {
        let settingsDoc = await Settings.findOne();

        if (!settingsDoc) {
            settingsDoc = new Settings();
            await settingsDoc.save();
        }

        res.json(settingsDoc);
    } catch (error) {
        console.error('Error al obtener configuración pública:', error);
        res.status(500).json({ msg: 'Error al obtener configuración pública', error });
    }
});

// Obtener configuración actual (privada)
router.get('/', verificarToken, async (_req: RequestConUsuario, res: Response) => {
    try {
        let settingsDoc = await Settings.findOne();

        if (!settingsDoc) {
            settingsDoc = new Settings();
            await settingsDoc.save();
        }

        const populated = await applyPopulateAutorSingle(Settings.findById(settingsDoc._id));

        res.json(populated);
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ msg: 'Error al obtener configuración', error });
    }
});

// Actualizar configuración
router.put('/:id', setActualizadoPor, verificarToken, async (req: RequestConUsuario, res: Response): Promise<void> => {
    try {
        // Validación básica de historia
        if (!req.body.historiaNosotros || typeof req.body.historiaNosotros !== 'object') {
            res.status(400).json({ msg: 'El contenido de historia es inválido.' });
            return;
        }

        // Actualizar y hacer populate
        const updatedDoc = await Settings.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedDoc?._id) {
            res.status(404).json({ msg: 'Configuración no encontrada tras la actualización.' });
            return;
        }

        await updatedDoc.populate('creadoPor actualizadoPor', 'nombre username imagen');

        // Registrar log
        await registrarLog({
            req,
            coleccion: 'Settings',
            accion: 'actualizar',
            referenciaId: updatedDoc._id.toString(),
            cambios: {
                despues: updatedDoc
            }
        });

        res.json(updatedDoc);
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ msg: 'Error al actualizar configuración', error });
    }
});

export default router;
