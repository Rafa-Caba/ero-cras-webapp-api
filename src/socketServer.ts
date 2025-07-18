import { Server } from 'socket.io';
import http from 'http';
import { configurarSockets } from './socket';
import { app } from './server';

const whitelist = [
    'http://localhost:5173', // Desarrollo local
    'https://ero-cras-webapp.vercel.app', // Frontend en Vercel
    'https://ero-cras-webapp-api-production.up.railway.app' // Railway API
];

export const iniciarSockets = (server: http.Server) => {
    // ✅ Configuración de CORS para Socket.io (usa la misma whitelist)
    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || whitelist.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by socket.io CORS'));
                }
            },
            methods: ['GET', 'POST']
        }
    });

    app.set('io', io);

    configurarSockets(io);
};