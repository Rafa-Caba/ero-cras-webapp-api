import express, { NextFunction, Request, Response } from 'express';
import verificarToken from '../middlewares/auth';
import cloudinary from '../utils/cloudinary';
import { uploadGalleryImage } from '../middlewares/cloudinaryStorage';
import Imagen from '../models/Imagen';

const router = express.Router();

// Crear imagen (Cloudinary)
router.post('/', verificarToken, uploadGalleryImage.single('imagen'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ mensaje: 'No se recibió imagen' });
            return;
        }

        const nuevaImagen = new Imagen({
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            imagenUrl: req.file?.path || '',
            imagenPublicId: req.file?.filename || '',
            imagenLeftMenu: req.body.imagenLeftMenu,
            imagenRightMenu: req.body.imagenRightMenu,
            imagenNosotros: req.body.imagenNosotros,
            imagenLogo: req.body.imagenLogo
        });

        await nuevaImagen.save();
        res.status(200).json({ mensaje: 'Imagen subida con Cloudinary', imagen: nuevaImagen });
    } catch (err: any) {
        res.status(400).json({ mensaje: err.message });
    }
});

// Obtener imágenes con paginación
router.get('/', verificarToken, async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
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
router.get('/:id', verificarToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const imagen = await Imagen.findById(req.params.id);
        if (!imagen) {
            res.status(404).json({ mensaje: 'No encontrada' });
            return;
        }
        res.json(imagen);
    } catch (err: any) {
        res.status(500).json({ mensaje: err.message });
    }
});

// Actualizar imagen
router.put('/:id', verificarToken, uploadGalleryImage.single('imagen'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { titulo, descripcion, imagenLeftMenu, imagenRightMenu, imagenNosotros, imagenLogo } = req.body;
    const imagenId = req.params.id;

    try {
        const imagen = await Imagen.findById(imagenId);
        if (!imagen) {
            res.status(404).json({ mensaje: 'Imagen no encontrada' });
            return;
        }

        if (req.file) {
            // Eliminar imagen anterior de Cloudinary
            if (imagen.imagenPublicId) {
                await cloudinary.uploader.destroy(imagen.imagenPublicId);
            }

            // Asignar nueva
            imagen.imagenUrl = req.file.path;
            imagen.imagenPublicId = req.file.filename;
        }

        imagen.titulo = titulo ?? imagen.titulo;
        imagen.descripcion = descripcion ?? imagen.descripcion;
        imagen.imagenLeftMenu = imagenLeftMenu ?? imagen.imagenLeftMenu;
        imagen.imagenRightMenu = imagenRightMenu ?? imagen.imagenRightMenu;
        imagen.imagenNosotros = imagenNosotros ?? imagen.imagenNosotros;
        imagen.imagenLogo = imagenLogo ?? imagen.imagenLogo;

        await imagen.save();
        res.json({ mensaje: 'Imagen actualizada correctamente', imagen });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar la imagen' });
    }
});

// Eliminar
router.delete('/:id', verificarToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const imagen = await Imagen.findById(req.params.id);
        if (!imagen) {
            res.status(404).json({ mensaje: 'No encontrada' });
            return;
        }

        // Eliminar imagen anterior de Cloudinary
        if (imagen.imagenPublicId) {
            await cloudinary.uploader.destroy(imagen.imagenPublicId);
        }

        await Imagen.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Imagen eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ mensaje: (err as Error).message });
    }
});

// Patch para campos individuales tipo destacar/logo/etc
router.patch('/marcar/:campo/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const campo = req.params.campo;
    const id = req.params.id.trim();

    try {
        const camposValidos = [
            'imagenInicio',
            'imagenLeftMenu',
            'imagenRightMenu',
            'imagenNosotros',
            'imagenLogo',
            'imagenGaleria'
        ];

        if (!camposValidos.includes(campo)) {
            res.status(400).json({ mensaje: 'Campo inválido' });
            return;
        }

        const update: Partial<Record<string, boolean>> = {};
        update[campo] = true;

        // ✅ Solo desmarcar otras si el campo es exclusivo (no para imagenGaleria)
        if (campo !== 'imagenGaleria') {
            await Imagen.updateMany({ [campo]: true }, { $set: { [campo]: false } });
        }

        const imagenActualizada = await Imagen.findByIdAndUpdate(id, { $set: update }, { new: true });

        res.json({ mensaje: `Campo ${campo} actualizado`, imagen: imagenActualizada });
    } catch (err) {
        res.status(500).json({ mensaje: (err as Error).message });
    }
});

router.patch('/marcar/imagenGaleria/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('Valor recibido:', req.body.valor);

    const id = req.params.id.trim();
    const { valor } = req.body; // Esperamos { valor: true } o { valor: false }

    if (typeof valor !== 'boolean') {
        res.status(400).json({ mensaje: 'Valor debe ser booleano (true o false)' });
        return;
    }

    try {
        const imagenActualizada = await Imagen.findByIdAndUpdate(
            id,
            { $set: { imagenGaleria: valor } },
            { new: true }
        );

        if (!imagenActualizada) {
            res.status(404).json({ mensaje: 'Imagen no encontrada' });
            return;
        }

        res.json({
            mensaje: `Campo imagenGaleria actualizado a ${valor}`,
            imagen: imagenActualizada,
        });
    } catch (err) {
        res.status(500).json({ mensaje: (err as Error).message });
    }
});


export default router;
