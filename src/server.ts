import dotenv from 'dotenv';
dotenv.config();

import express, { Application, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import loginRoutes from './routes/login';
import themesRoutes from './routes/themes';
import cantosRoutes from './routes/cantos';
import usuariosRoutes from './routes/usuarios';
import miembrosRoutes from './routes/miembros';
import uploadsRoutes from './routes/uploads';
import blogPostRoutes from './routes/blogPosts';
import avisoRoutes from './routes/avisos';
import settingRoutes from './routes/settings';
import { ensureSettingsExists } from './utils/initSettings';

export const app: Application = express();

// Middlewares
app.use(cors({
    origin: (origin, callback) => {
        const whitelist = [
            'http://localhost:5173',
            'https://ero-cras-webapp.vercel.app',
            'https://ero-cras-webapp-api-production.up.railway.app'
        ];

        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/login', loginRoutes);
app.use('/api/cantos', cantosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/miembros', miembrosRoutes);

app.use('/api/uploads', uploadsRoutes);
app.use('/api/themes', themesRoutes);
app.use('/api/blog-posts', blogPostRoutes);
app.use('/api/avisos', avisoRoutes);
app.use('/api/settings', settingRoutes);

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
    .then(async () => {
        await ensureSettingsExists();
        app.listen(PORT, () => {
            console.log(`Servidor listo en el puerto ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Error de conexión a MongoDB:', err);
    });
