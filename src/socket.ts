// src/socket.ts

import { authenticateSocket } from './middlewares/authenticateSocket';
import {
    getSocketChoirRoom,
    registerSocketConnection,
    registerSocketServer,
    unregisterSocketConnection
} from './services/socketRegistry.service';
import type { ChoirSocket, ChoirSocketServer } from './types/socket.types';

const initializeSocketConnection = async (
    socket: ChoirSocket
): Promise<void> => {
    const user = socket.data.auth.user;
    const choirRoom = getSocketChoirRoom(user.choirId);

    await socket.join(choirRoom);
    await socket.join(`user:${user.id}`);
    registerSocketConnection(socket);

    console.info('Socket connected', {
        socketId: socket.id,
        userId: user.id,
        choirId: user.choirId,
        transport: socket.conn.transport.name
    });

    socket.conn.on('upgrade', (transport) => {
        console.info('Socket transport upgraded', {
            socketId: socket.id,
            userId: user.id,
            choirId: user.choirId,
            transport: transport.name
        });
    });

    socket.conn.on('error', (error) => {
        console.warn('Socket transport error', {
            socketId: socket.id,
            userId: user.id,
            choirId: user.choirId,
            message: error.message,
            transport: socket.conn.transport.name
        });
    });

    socket.on('typing', (isTyping) => {
        if (typeof isTyping !== 'boolean') {
            return;
        }

        socket.to(choirRoom).emit('user-typing', {
            userId: user.id,
            username: user.username,
            isTyping
        });
    });

    socket.on('disconnect', (reason) => {
        unregisterSocketConnection(socket.id);
        console.info('Socket disconnected', {
            socketId: socket.id,
            userId: user.id,
            choirId: user.choirId,
            reason
        });
    });
};

export const configuringSockets = (io: ChoirSocketServer): void => {
    registerSocketServer(io);
    io.use(authenticateSocket);

    io.engine.on('connection_error', (error) => {
        const request = error.req;
        console.warn('Socket connection error', {
            code: error.code,
            message: error.message,
            url: request?.url ?? null,
            origin: request?.headers.origin ?? null,
            upgrade: request?.headers.upgrade ?? null,
            connection: request?.headers.connection ?? null,
            userAgent: request?.headers['user-agent'] ?? null,
            forwardedFor: request?.headers['x-forwarded-for'] ?? null,
            replicaId: process.env.RAILWAY_REPLICA_ID ?? null
        });
    });

    io.on('connection', (socket) => {
        initializeSocketConnection(socket).catch((error: Error) => {
            console.error('Socket initialization failed', {
                socketId: socket.id,
                message: error.message
            });
            unregisterSocketConnection(socket.id);
            socket.disconnect(true);
        });
    });
};
