import dotenv from 'dotenv';
dotenv.config();

import express, { Application, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { configuringSockets } from './socket';

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import songRoutes from './routes/song';
import songTypeRoutes from './routes/songType';
import memberRoutes from './routes/member';
import galleryRoutes from './routes/gallery';
import blogRoutes from './routes/blog';
import announcementRoutes from './routes/announcement';
import settingsRoutes from './routes/setting';
import logRoutes from './routes/log';
import themeRoutes from './routes/theme';
import chatRoutes from './routes/chat';

import { ensureSettingsExists } from './utils/initSettings';
import { createDefaultThemes } from './utils/initialThemes';

export const app: Application = express();

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
    console.error('Missing MONGO_URI in .env file');
    process.exit(1);
}

const whitelist = [
    'http://localhost:5173', // Web Dev
    'http://localhost:8081', // Mobile Dev
    'https://ero-cras-webapp.vercel.app', // Web Prod
    'https://ero-cras-webapp-api-production.up.railway.app' // Self / API
];

const isOriginAllowed = (origin?: string | null): boolean => {
    if (!origin) return true;

    return whitelist.some((base) => {
        return origin === base || origin.startsWith(base);
    });
};

app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS (HTTP):', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/song-types', songTypeRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/chat', chatRoutes);

app.use((req: Request, res: Response) => {
    res.status(404).json({
        message: 'Route not found',
        method: req.method,
        path: req.originalUrl
    });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

mongoose.connect(MONGO_URI)
    .then(async () => {
        await ensureSettingsExists();
        await createDefaultThemes();

        const httpServer = http.createServer(app);

        const io = new SocketIOServer(httpServer, {
            cors: {
                origin: (origin, callback) => {
                    if (isOriginAllowed(origin)) {
                        callback(null, true);
                    } else {
                        console.log('Blocked by CORS (Socket.IO):', origin);
                        callback(new Error('Not allowed by CORS'));
                    }
                },
                methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                credentials: true
            }
        });

        app.set('io', io);
        configuringSockets(io);

        httpServer.listen(PORT, () => {
            // console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
    });
