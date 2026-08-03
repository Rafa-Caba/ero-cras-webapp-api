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
    registerSocketConnection(socket);

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

    socket.on('disconnect', () => {
        unregisterSocketConnection(socket.id);
    });
};

export const configuringSockets = (io: ChoirSocketServer): void => {
    registerSocketServer(io);
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        initializeSocketConnection(socket).catch(() => {
            unregisterSocketConnection(socket.id);
            socket.disconnect(true);
        });
    });
};
