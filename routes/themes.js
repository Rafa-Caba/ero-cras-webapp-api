const express = require('express');
const router = express.Router();
const Theme = require('../models/Theme');

// Obtener todos los colores del tema con paginación
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const totalTemas = await Theme.countDocuments();
        const totalPaginas = Math.ceil(totalTemas / limit);

        const temas = await Theme.find().skip(skip).limit(limit);

        res.json({
            temas,
            paginaActual: page,
            totalPaginas
        });
    } catch (err) {
        res.status(500).json({ msg: 'Error al obtener los temas', error: err.message });
    }
});

// Obtener una clase de color por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const color = await Theme.findById(id);
        if (!color) return res.status(404).json({ msg: 'Clase de color no encontrada' });
        res.json(color);
    } catch (err) {
        res.status(500).json({ msg: 'Error al obtener clase de color', error: err.message });
    }
});

// Actualizar una clase de color por ID
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, colorClass, color } = req.body;

        const actualizado = await Theme.findByIdAndUpdate(
            id,
            { nombre, colorClass, color },
            { new: true }
        );

        if (!actualizado) return res.status(404).json({ msg: 'Clase de color no encontrada' });

        res.json(actualizado);
    } catch (err) {
        res.status(500).json({ msg: 'Error al actualizar clase de color', error: err.message });
    }
});

// Crear una nueva clase de color
router.post('/new', async (req, res) => {
    try {
        const { nombre, color, colorClass } = req.body;
        const existente = await Theme.findOne({ colorClass });
        if (existente) return res.status(400).json({ msg: 'Ya existe esa clase de color.' });

        const nuevo = new Theme({ nombre, color, colorClass });
        await nuevo.save();
        res.status(201).json(nuevo);
    } catch (err) {
        res.status(500).json({ msg: 'Error al crear clase de color', error: err.message });
    }
});

// Elimina una Clase Color
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Theme.findByIdAndDelete(id);
        res.json({ msg: 'Color eliminado' });
    } catch (err) {
        res.status(500).json({ msg: 'Error al eliminar clase de color', error: err.message });
    }
});

module.exports = router;
