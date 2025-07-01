const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/auth');
const Canto = require('../models/Canto');

// Crear
router.post('/', verificarToken, async (req, res) => {
    try {
        const nuevoCanto = new Canto(req.body);
        await nuevoCanto.save();
        res.status(201).json(nuevoCanto);
    } catch (error) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Leer todos
router.get('/', verificarToken, async (req, res) => {
    try {
        const cantos = await Canto.find();
        res.json(cantos);
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Obtener un solo canto por ID
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const canto = await Canto.findById(req.params.id);

        if (!canto) {
            return res.status(404).json({ mensaje: 'Canto no encontrado' });
        }

        res.json(canto);
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Actualizar
router.put('/:id', verificarToken, async (req, res) => {
    try {
        const actualizado = await Canto.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(actualizado);
    } catch (error) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        await Canto.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Canto eliminado' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

module.exports = router;
