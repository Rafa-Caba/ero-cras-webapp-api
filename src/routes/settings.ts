import express from 'express';
import Settings from '../models/Settings.';
import verificarToken from '../middlewares/auth';
import { setActualizadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog } from '../utils/registrarLog';

const router = express.Router();

// Obtener configuración públicamente
router.get('/public', async (req, res) => {
    try {
        // Buscar configuración
        let settingsDoc = await Settings.findOne();

        // Si no existe, crear una nueva
        if (!settingsDoc) {
            settingsDoc = new Settings();
            await settingsDoc.save();
        }

        // Devolver el documento garantizado
        res.json(settingsDoc);
    } catch (error) {
        console.error('Error al obtener configuración pública:', error);
        res.status(500).json({ msg: 'Error al obtener configuración pública', error });
    }
});


// Obtener configuración actual
router.get('/', verificarToken, async (req, res) => {
    try {
        // Buscar configuración base
        let settingsDoc = await Settings.findOne();

        // Si no existe, crear
        if (!settingsDoc) {
            settingsDoc = new Settings();
            await settingsDoc.save();
        }

        // Hacer populate con el _id garantizado
        const settings = await applyPopulateAutorSingle(Settings.findById(settingsDoc._id));

        res.json(settings);
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ msg: 'Error al obtener configuración', error });
    }
});

// Actualizar configuración
router.put('/:id', setActualizadoPor, verificarToken, async (req, res) => {
    try {
        const updated = await Settings.findByIdAndUpdate(req.params.id, req.body, { new: true });

        if (!updated?._id) return;

        await registrarLog({
            req,
            coleccion: 'Settings',
            accion: 'actualizar',
            referenciaId: updated._id.toString(),
            cambios: {
                despues: updated
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar configuración', error });
    }
});

export default router;
