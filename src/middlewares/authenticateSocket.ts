// src/middlewares/authenticateSocket.ts

import type { ExtendedError } from 'socket.io';
import { AppError } from '../errors/AppError';
import { authenticateSocketConnection } from '../services/socketAuth.service';
import type { ChoirSocket } from '../types/socket.types';

class SocketAuthenticationError extends Error {
    public readonly data: {
        readonly code: string;
        readonly statusCode: number;
    };

    public constructor(error: AppError) {
        super(error.message);
        this.name = 'SocketAuthenticationError';
        this.data = {
            code: error.code,
            statusCode: error.statusCode
        };
    }
}

export const authenticateSocket = async (
    socket: ChoirSocket,
    next: (error?: ExtendedError) => void
): Promise<void> => {
    try {
        socket.data.auth = await authenticateSocketConnection(socket);
        next();
    } catch (error) {
        if (error instanceof AppError) {
            console.error('Socket authentication rejected', {
                socketId: socket.id,
                code: error.code,
                statusCode: error.statusCode,
                message: error.message
            });
            next(new SocketAuthenticationError(error));
            return;
        }

        if (error instanceof Error) {
            console.error('Socket authentication failed', {
                socketId: socket.id,
                message: error.message
            });
            next(error);
            return;
        }

        console.error('Socket authentication failed', {
            socketId: socket.id,
            message: 'Unexpected socket authentication error'
        });
        next(new Error('Socket authentication failed'));
    }
};
