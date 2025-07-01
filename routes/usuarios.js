const express = require('express');
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const verificarToken = require('../middlewares/auth');
const Usuario = require('../models/Usuario');


// Configuración de Multer
const storage = multer.diskStorage({
    destination: 'uploads/images_members/',
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
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


// Registrar nuevo usuario con imagen
router.post('/', upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nombre, username, correo, password, rol } = req.body;

        if (!nombre || !username || !correo || !password) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
        }

        const existe = await Usuario.findOne({
            $or: [{ username: username.toLowerCase() }, { correo }]
        });
        if (existe) {
            return res.status(409).json({ mensaje: 'El usuario o correo ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoUsuario = new Usuario({
            nombre,
            username: username.toLowerCase(),
            correo,
            password: hashedPassword, // 👈 Guarda el hash, no la password en texto plano
            rol,
            fotoPerfilUrl: req.file ? `${req.protocol}://${req.get('host')}/uploads/images_members/${req.file.filename}` : ''
        });

        await nuevoUsuario.save();

        res.status(200).json({
            mensaje: 'Usuario creado exitosamente',
            usuario: {
                _id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                username: nuevoUsuario.username,
                correo: nuevoUsuario.correo,
                rol: nuevoUsuario.rol,
                fotoPerfilUrl: nuevoUsuario.fotoPerfilUrl
            }
        });

    } catch (error) {
        res.status(400).json({ mensaje: error.message });
    }
});


// GET /api/usuarios/buscar?q=rafa
router.get('/buscar', verificarToken, async (req, res) => {
    const query = req.query.q?.toString().trim();

    // console.log('query: ' + query);

    if (!query) {
        return res.status(400).json({ mensaje: 'Consulta vacía' });
    }

    try {
        const regex = new RegExp(query, 'i'); // insensible a mayúsculas/minúsculas

        const usuarios = await Usuario.find({
            $or: [
                { nombre: regex },
                { correo: regex },
                { username: regex }
            ]
        });

        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la búsqueda' });
    }
});


// GET paginado de usuarios
router.get('/', verificarToken, async (req, res) => {
    try {
        const pagina = parseInt(req.query.page) || 1;
        const limite = parseInt(req.query.limit) || 5;
        const skip = (pagina - 1) * limite;

        const [usuarios, total] = await Promise.all([
            Usuario.find().sort({ nombre: 1 }).skip(skip).limit(limite),
            Usuario.countDocuments()
        ]);

        res.json({
            usuarios,
            paginaActual: pagina,
            totalPaginas: Math.ceil(total / limite),
            totalUsuarios: total
        });
    } catch (error) {
        console.error('Error al obtener los usuarios:', error);
        res.status(500).json({ mensaje: 'Error al obtener los usuarios' });
    }
});


// Obtener Un usuario
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.params.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json(usuario);
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});


// Actualizar
router.put('/:id', verificarToken, upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nombre, username, correo, password, rol } = req.body;

        console.log({
            nombre, username, correo, password, rol
        });

        const urlImagen = req.file ? `${req.protocol}://${req.get('host')}/uploads/images_members/${req.file.filename}` : undefined;

        // Solo actualiza si hay cambios (para no pisar con undefined)
        const updateFields = {};

        if (nombre) updateFields.nombre = nombre;
        if (username) updateFields.username = username;
        if (correo) updateFields.correo = correo;
        if (password) updateFields.password = password;
        if (rol) updateFields.rol = rol;
        if (urlImagen) updateFields.fotoPerfilUrl = urlImagen;

        const actualizado = await Usuario.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );

        res.json(actualizado);
    } catch (error) {
        res.status(400).json({ mensaje: error.message });
    }
});


// Eliminar
router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        // Eliminar archivo de imagen si existe
        if (usuario.fotoPerfilUrl) {
            const fileName = usuario.fotoPerfilUrl.split('/').pop();
            const filePath = path.join(__dirname, '..', 'uploads', 'images_members', fileName);

            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Error eliminando imagen de usuario:', err);
                }
            });
        }

        await Usuario.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Usuario y su imagen eliminados correctamente' });

    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

module.exports = router;
