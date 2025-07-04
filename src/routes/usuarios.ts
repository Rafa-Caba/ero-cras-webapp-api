import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import cloudinary from '../utils/cloudinary';
import { uploadUserImage } from '../middlewares/cloudinaryStorage';

import verificarToken from '../middlewares/auth';
import Usuario from '../models/Usuario';

const router = express.Router();

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
        }).select('nombre username correo rol fotoPerfilUrl'); // 🔍 solo campos visibles

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
            Usuario.find()
                .sort({ nombre: 1 })
                .skip(skip)
                .limit(limite)
                .select('nombre username correo rol fotoPerfilUrl'), // 👌 sin datos sensibles
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
        const usuario = await Usuario.findById(req.params.id)
            .select('nombre username correo rol fotoPerfilUrl'); // 🛡️ sin password ni publicId

        if (!usuario) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        res.json(usuario);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});


// Crear usuario con imagen (Cloudinary)
router.post('/', uploadUserImage.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
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
            fotoPerfilUrl: req.file?.path || '',
            fotoPerfilPublicId: req.file?.filename || ''
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

// Actualizar usuario con Cloudinary
router.put('/:id', verificarToken, uploadUserImage.single('fotoPerfil'), async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, username, correo, password, rol } = req.body;

        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        // Si hay nueva imagen, eliminar la anterior de Cloudinary
        if (req.file && usuario.fotoPerfilPublicId) {
            await cloudinary.uploader.destroy(usuario.fotoPerfilPublicId);
        }

        const updateFields: Record<string, any> = {
            ...(nombre && { nombre }),
            ...(username && { username }),
            ...(correo && { correo }),
            ...(password && { password }),
            ...(rol && { rol }),
        };

        if (req.file) {
            updateFields.fotoPerfilUrl = req.file.path;
            updateFields.fotoPerfilPublicId = req.file.filename;
        }

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

// Eliminar usuario y foto de Cloudinary
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            res.status(404).json({ mensaje: 'Usuario no encontrado' });
            return;
        }

        if (usuario.fotoPerfilPublicId) {
            await cloudinary.uploader.destroy(usuario.fotoPerfilPublicId);
        }

        await Usuario.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

export default router;