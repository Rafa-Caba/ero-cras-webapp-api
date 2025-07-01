const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const verificarToken = require('../middlewares/auth');

const Imagen = require('../models/Imagen');

// Configurar multer
const storage = multer.diskStorage({
    destination: 'uploads/gallery_images/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.gif') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'), false);
        }
    }
});


// Crear imagen
router.post('/', verificarToken, upload.single('imagen'), async (req, res) => {
    try {
        const nuevaImagen = new Imagen({
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            imagenUrl: req.file ? `${req.protocol}://${req.get('host')}/uploads/gallery_images/${req.file.filename}` : ''
        });

        await nuevaImagen.save();
        res.status(200).json({ mensaje: 'Imagen subida', imagen: nuevaImagen });
    } catch (err) {
        res.status(400).json({ mensaje: err.message });
    }
});


// Obtener imágenes con paginación
router.get('/', verificarToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    try {
        const total = await Imagen.countDocuments();
        const imagenes = await Imagen.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            imagenes,
            paginaActual: page,
            totalPaginas: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener las imágenes' });
    }
});


// Obtener una
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const imagen = await Imagen.findById(req.params.id);

        if (!imagen) return res.status(404).json({ mensaje: 'No encontrada' });

        res.json(imagen);
    } catch (err) {
        res.status(500).json({ mensaje: err.message });
    }
});


// PUT /api/uploads/:id
router.put('/:id', upload.single('imagen'), async (req, res) => {
    const { titulo, descripcion } = req.body;
    const imagenId = req.params.id;

    try {
        const imagen = await Imagen.findById(imagenId);
        if (!imagen) {
            return res.status(404).json({ mensaje: 'Imagen no encontrada' });
        }

        // Si se subió una nueva imagen
        if (req.file) {
            // Eliminar la imagen anterior del servidor
            const oldPath = path.join(__dirname, '..', 'uploads', 'gallery_images', path.basename(imagen.imagenUrl));
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }

            // Actualizar URL con la nueva imagen
            imagen.imagenUrl = `/gallery_images/${req.file.filename}`;
        }

        // Actualizar campos de texto
        if (titulo) imagen.titulo = titulo;
        if (descripcion) imagen.descripcion = descripcion;

        await imagen.save();

        res.json({ mensaje: 'Imagen actualizada correctamente', imagen });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar la imagen' });
    }
});


// Eliminar
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const imagen = await Imagen.findById(req.params.id);
        if (!imagen) return res.status(404).json({ mensaje: 'No encontrada' });

        const fileName = imagen.imagenUrl.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', 'gallery_images', fileName);

        fs.unlink(filePath, err => {
            if (err && err.code !== 'ENOENT') console.error(err);
        });

        await Imagen.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Imagen eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ mensaje: err.message });
    }
});


// PATCH /uploads/destacar/:id
router.patch('/destacar/:id', async (req, res) => {
    try {
        // Quitar la imagen destacada actual (si existe)
        await Imagen.updateMany({ destacada: true }, { $set: { destacada: false } });

        // Establecer la nueva como destacada
        const imagenActualizada = await Imagen.findByIdAndUpdate(
            req.params.id,
            { $set: { destacada: true } },
            { new: true }
        );

        res.json({ mensaje: 'Imagen destacada actualizada', imagen: imagenActualizada });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al destacar imagen', error });
    }
});

module.exports = router;
