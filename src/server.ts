import dotenv from 'dotenv';
dotenv.config();

import express, { Application, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import loginRoutes from './routes/login';
import themesRoutes from './routes/themes';
import cantosRoutes from './routes/cantos';
import usuariosRoutes from './routes/usuarios';
import uploadsRoutes from './routes/uploads';

export const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/login', loginRoutes);
app.use('/api/cantos', cantosRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.use('/api/uploads', uploadsRoutes);
app.use('/api/themes', themesRoutes);

// 404 para rutas no encontradas
app.use((req: Request, res: Response) => {
    res.status(404).json({
        mensaje: 'Ruta no encontrada',
        metodo: req.method,
        ruta: req.originalUrl
    });
});

// Middleware general de errores
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
});

// Conexión a la base de datos
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
    console.error('Falta MONGO_URI en el archivo .env');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor listo en el puerto ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Error de conexión a MongoDB:', err);
    });
