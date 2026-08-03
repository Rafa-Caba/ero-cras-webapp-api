// src/services/socketRegistry.service.ts

import type {
    ChoirSocket,
    ChoirSocketServer,
    SocketDisconnectNotice,
    SocketPresenceUser
} from '../types/socket.types';

interface PresenceConnection {
    readonly socketId: string;
    readonly userId: string;
    readonly choirId: string;
}

let socketServer: ChoirSocketServer | undefined;
const connections = new Map<string, PresenceConnection>();

const getChoirRoom = (choirId: string): string => `choir:${choirId}`;

export const registerSocketServer = (io: ChoirSocketServer): void => {
    socketServer = io;
};

const buildChoirPresence = (choirId: string): readonly SocketPresenceUser[] => {
    if (!socketServer) {
        return [];
    }

    const users = new Map<string, SocketPresenceUser>();

    for (const connection of connections.values()) {
        if (connection.choirId !== choirId) {
            continue;
        }

        const socket = socketServer.sockets.sockets.get(connection.socketId);

        if (!socket) {
            continue;
        }

        const authenticatedUser = socket.data.auth.user;
        const existingUser = users.get(authenticatedUser.id);

        users.set(authenticatedUser.id, {
            ...authenticatedUser,
            connectionCount: (existingUser?.connectionCount ?? 0) + 1
        });
    }

    return [...users.values()].sort((left, right) => {
        return left.name.localeCompare(right.name);
    });
};

export const emitChoirPresence = (choirId: string): void => {
    if (!socketServer) {
        return;
    }

    socketServer
        .to(getChoirRoom(choirId))
        .emit('online-users', buildChoirPresence(choirId));
};

export const registerSocketConnection = (socket: ChoirSocket): void => {
    const user = socket.data.auth.user;

    connections.set(socket.id, {
        socketId: socket.id,
        userId: user.id,
        choirId: user.choirId
    });

    emitChoirPresence(user.choirId);
};

export const unregisterSocketConnection = (socketId: string): void => {
    const connection = connections.get(socketId);
    connections.delete(socketId);

    if (connection) {
        emitChoirPresence(connection.choirId);
    }
};

const disconnectMatchingSockets = (
    matches: (connection: PresenceConnection) => boolean,
    notice: SocketDisconnectNotice
): void => {
    if (!socketServer) {
        return;
    }

    for (const connection of [...connections.values()]) {
        if (!matches(connection)) {
            continue;
        }

        const socket = socketServer.sockets.sockets.get(connection.socketId);

        if (!socket) {
            connections.delete(connection.socketId);
            continue;
        }

        socket.emit('session-disconnected', notice);
        socket.disconnect(true);
    }
};

export const disconnectUserSockets = (
    userId: string,
    code: string,
    message: string
): void => {
    disconnectMatchingSockets(
        (connection) => connection.userId === userId,
        { code, message }
    );
};

export const disconnectChoirSockets = (
    choirId: string,
    code: string,
    message: string
): void => {
    disconnectMatchingSockets(
        (connection) => connection.choirId === choirId,
        { code, message }
    );
};

export const getSocketChoirRoom = getChoirRoom;
