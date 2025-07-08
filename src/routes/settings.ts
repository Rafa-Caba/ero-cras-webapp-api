import express from 'express';
import Settings from '../models/Settings.';
import verificarToken from '../middlewares/auth';

const router = express.Router();

// Obtener configuración públicamente
router.get('/public', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }

        res.json(settings);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener configuración pública', error });
    }
});

// Obtener configuración actual
router.get('/', verificarToken, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }

        res.json(settings);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener configuración', error });
    }
});

// Actualizar configuración
router.put('/:id', verificarToken, async (req, res) => {
    try {
        const updated = await Settings.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar configuración', error });
    }
});

export default router;
