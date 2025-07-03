// routes/usuarios.ts (versión TypeScript)

import express, { Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

import verificarToken from '../middlewares/auth';
import Usuario from '../models/Usuario';

const router = express.Router();

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
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// Registrar nuevo usuario con imagen
router.post('/', upload.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, username, correo, password, rol } = req.body;

        if (!nombre || !username || !correo || !password) {
            res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
            return;
        }

        const existe = await Usuario.findOne({
            $or: [{ username: username.toLowerCase() }, { correo }]
        });

        if (existe) {
            res.status(409).json({ mensaje: 'El usuario o correo ya existe' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoUsuario = new Usuario({
            nombre,
            username: username.toLowerCase(),
            correo,
            password: hashedPassword,
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
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// GET /api/usuarios/buscar?q=rafa
router.get('/buscar', verificarToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();

    if (!query) {
        res.status(400).json({ mensaje: 'Consulta vacía' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
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
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const pagina = parseInt(req.query.page as string) || 1;
        const limite = parseInt(req.query.limit as string) || 5;
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
        res.status(500).json({ mensaje: 'Error al obtener los usuarios' });
    }
});

// Obtener un usuario
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }
        res.json(usuario);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Actualizar usuario
router.put('/:id', verificarToken, upload.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, username, correo, password, rol } = req.body;
        const urlImagen = req.file ? `${req.protocol}://${req.get('host')}/uploads/images_members/${req.file.filename}` : undefined;

        const updateFields: Record<string, any> = {};
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
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar usuario
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        if (usuario.fotoPerfilUrl) {
            const fileName = usuario.fotoPerfilUrl.split('/').pop();
            const filePath = path.join(__dirname, '..', 'uploads', 'images_members', fileName || '');
            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Error eliminando imagen de usuario:', err);
                }
            });
        }

        await Usuario.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Usuario y su imagen eliminados correctamente' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;