import express, { Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import cloudinary from '../utils/cloudinary';
import { uploadBlogImage } from '../middlewares/cloudinaryStorage';
import verificarToken from '../middlewares/auth';
import BlogPost, { Comentario } from '../models/BlogPost';
import { setActualizadoPor, setCreadoPor } from '../utils/setCreadoPor';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registrarLog } from '../utils/registrarLog';
import type { JSONContent } from '@tiptap/react';

const router = express.Router();

interface ComentarioParams extends ParamsDictionary {
    id: string;
}

interface ComentarioBody {
    autor: string;
    texto: JSONContent;
}

// Obtener todos los posts públicos (publicado: true)
router.get('/publicos', async (req: Request, res: Response): Promise<void> => {
    try {
        const posts = await BlogPost.find({ publicado: true })
            .sort({ createdAt: -1 })
            .select('titulo autor contenido createdAt imagenUrl likes comentarios');

        res.json(posts);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Obtener un solo post público por ID
router.get('/publico/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findOne({
            _id: req.params.id,
            publicado: true
        });

        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado o no publicado' });
            return;
        }

        res.json(post);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Buscar posts
router.get('/buscar', verificarToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();
    if (!query) {
        res.status(400).json({ mensaje: 'Consulta vacía' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const posts = await applyPopulateAutores(BlogPost.find({
            $or: [{ titulo: regex }] // contenido eliminado por ser JSON
        }).select('titulo autor createdAt likes comentarios imagenUrl publicado'));

        res.json(posts);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la búsqueda' });
    }
});

// Obtener todos los posts paginados
router.get('/', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const pagina = parseInt(req.query.page as string) || 1;
        const limite = parseInt(req.query.limit as string) || 5;
        const skip = (pagina - 1) * limite;

        const [posts, total] = await Promise.all([
            applyPopulateAutores(BlogPost.find()
                .sort({ createdAt: -1 }) // corregido
                .skip(skip)
                .limit(limite)
                .select('titulo autor createdAt likes comentarios imagenUrl publicado')),
            BlogPost.countDocuments()
        ]);

        res.json({
            posts,
            paginaActual: pagina,
            totalPaginas: Math.ceil(total / limite),
            totalPosts: total
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener posts' });
    }
});

// Obtener un post por ID
router.get('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await applyPopulateAutorSingle(BlogPost.findById(req.params.id));
        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado' });
            return;
        }
        res.json(post);
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Crear nuevo post
router.post('/', verificarToken, uploadBlogImage.single('imagen'), setCreadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, contenido, autor, publicado } = req.body;

        if (!contenido || Object.keys(contenido).length === 0) {
            res.status(400).json({ mensaje: 'Contenido inválido' });
            return;
        }

        const nuevoPost = new BlogPost({
            titulo,
            contenido,
            autor,
            publicado,
            imagenUrl: req.file?.path || '',
            imagenPublicId: req.file?.filename || '',
            creadoPor: req.body.creadoPor
        });

        await nuevoPost.save();

        if (!nuevoPost._id) return;

        await registrarLog({
            req,
            coleccion: 'BlogPosts',
            accion: 'crear',
            referenciaId: nuevoPost._id.toString(),
            cambios: { nuevo: nuevoPost }
        });

        res.status(201).json({ mensaje: 'Post creado exitosamente', post: nuevoPost });
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Actualizar post
router.put('/:id', verificarToken, uploadBlogImage.single('imagen'), setActualizadoPor, async (req: Request, res: Response): Promise<void> => {
    try {
        const { titulo, contenido, autor, publicado } = req.body;

        if (!contenido || Object.keys(contenido).length === 0) {
            res.status(400).json({ mensaje: 'Contenido inválido' });
            return;
        }

        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado' });
            return;
        }

        if (req.file && post.imagenPublicId) {
            await cloudinary.uploader.destroy(post.imagenPublicId);
        }

        const fieldsToUpdate: Record<string, any> = {
            ...(titulo && { titulo }),
            ...(contenido && { contenido }),
            ...(autor && { autor }),
            ...(publicado && { publicado })
        };

        if (req.file) {
            fieldsToUpdate.imagenUrl = req.file.path;
            fieldsToUpdate.imagenPublicId = req.file.filename;
        }

        const actualizado = await BlogPost.findByIdAndUpdate(req.params.id, { $set: fieldsToUpdate }, { new: true });

        if (!actualizado?._id) return;

        await registrarLog({
            req,
            coleccion: 'BlogPosts',
            accion: 'actualizar',
            referenciaId: actualizado._id.toString(),
            cambios: { actualizado } // corregido aquí
        });

        res.json(actualizado);
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

// Eliminar post
router.delete('/:id', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado' });
            return;
        }

        if (post.imagenPublicId) {
            await cloudinary.uploader.destroy(post.imagenPublicId);
        }

        await BlogPost.findByIdAndDelete(req.params.id);

        if (!post._id) return;

        await registrarLog({
            req,
            coleccion: 'BlogPosts',
            accion: 'eliminar',
            referenciaId: post._id.toString(),
            cambios: { eliminado: post }
        });

        res.json({ mensaje: 'Post eliminado correctamente' });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Funcion para manejar los Likes en Posts
router.post('/:id/toggle-like', verificarToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado' });
            return;
        }

        // const userId = req.usuario?.id; // Recomendado si lo tienes del token
        const userId = req.body.userId;

        if (!userId) {
            res.status(400).json({ mensaje: 'Falta el ID del usuario' });
            return;
        }

        const yaDioLike = post.likesUsuarios.includes(userId);

        if (yaDioLike) {
            post.likesUsuarios = post.likesUsuarios.filter(id => id !== userId);
        } else {
            post.likesUsuarios.push(userId);
        }

        post.likes = post.likesUsuarios.length;
        await post.save();

        res.json({
            mensaje: yaDioLike ? 'Like removido' : 'Like agregado',
            likes: post.likes,
            yaDioLike: !yaDioLike
        });
    } catch (error: any) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Agregar comentario a un post
router.post('/:id/comentarios', verificarToken, async (req: Request<ComentarioParams, {}, ComentarioBody>, res: Response): Promise<void> => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            res.status(404).json({ mensaje: 'Post no encontrado' });
            return;
        }

        const { autor, texto } = req.body;
        if (!autor || !texto) {
            res.status(400).json({ mensaje: 'Faltan datos del comentario' });
            return;
        }

        const nuevoComentario = {
            autor,
            texto,
            fecha: new Date(),
        };

        post.comentarios.unshift(nuevoComentario);
        await post.save();

        res.json({ mensaje: 'Comentario agregado', comentarios: post.comentarios });
    } catch (error: any) {
        res.status(400).json({ mensaje: error.message });
    }
});

export default router;
