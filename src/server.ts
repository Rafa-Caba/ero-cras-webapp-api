// src/server.ts

import express, { Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type {
    ChoirSocketData,
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents
} from './types/socket.types';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { isOriginAllowed } from './config/cors';
import { errorHandler, notFoundHandler } from './middlewares/httpErrors';
import { configuringSockets } from './socket';

import authRoutes from './routes/auth';
import choirsRouter from './routes/choirs';
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
import instrumentsRouter from './routes/instruments';
import publicRoutes from './routes/public';
import mediaRoutes from './routes/media';
import pushDeviceRoutes from './routes/pushDevice';
import { startPushReceiptProcessor } from './services/expoPush.service';

export const app: Application = express();

app.set('trust proxy', 1);

app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

const isSocketIoRequest = (req: Request): boolean =>
    req.path === '/socket.io' || req.path.startsWith('/socket.io/');

const jsonParser = express.json({ limit: '100mb' });
const urlencodedParser = express.urlencoded({ limit: '100mb', extended: true });

app.use((req: Request, res: Response, next: NextFunction) => {
    if (isSocketIoRequest(req)) {
        next();
        return;
    }

    jsonParser(req, res, next);
});

app.use((req: Request, res: Response, next: NextFunction) => {
    if (isSocketIoRequest(req)) {
        next();
        return;
    }

    urlencodedParser(req, res, next);
});

app.use('/api/public/:choirCode', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/choirs', choirsRouter);
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
app.use('/api/instruments', instrumentsRouter);
app.use('/api/media', mediaRoutes);
app.use('/api/push-devices', pushDeviceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
    await connectDatabase();

    const httpServer = http.createServer(app);
    const io = new SocketIOServer<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        ChoirSocketData
    >(httpServer, {
        transports: ['websocket', 'polling'],
        allowUpgrades: true,
        pingInterval: 25_000,
        pingTimeout: 30_000,
        cors: {
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) {
                    callback(null, true);
                    return;
                }

                callback(new Error('Not allowed by CORS'));
            },
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            credentials: true
        }
    });

    app.set('io', io);
    configuringSockets(io);
    startPushReceiptProcessor();

    httpServer.listen(env.port, () => {
        console.log(`API listening on port ${env.port}`);
    });
};

startServer().catch((error: Error) => {
    console.error('API startup failed:', error.message);
    process.exitCode = 1;
});
