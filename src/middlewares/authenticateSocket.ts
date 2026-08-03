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
            next(new SocketAuthenticationError(error));
            return;
        }

        if (error instanceof Error) {
            next(error);
            return;
        }

        next(new Error('Socket authentication failed'));
    }
};
