// src/types/socket.types.ts

import type { Server, Socket } from 'socket.io';
import type { UserRole } from './roles.types';

export interface SocketAuthenticatedUser {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly imageUrl: string;
    readonly role: UserRole;
    readonly choirId: string;
}

export interface SocketAuthenticatedContext {
    readonly tokenId: string;
    readonly user: SocketAuthenticatedUser;
}

export interface SocketPresenceUser extends SocketAuthenticatedUser {
    readonly connectionCount: number;
}

export interface SocketTypingEvent {
    readonly userId: string;
    readonly username: string;
    readonly isTyping: boolean;
}

export interface SocketNotificationRemoval {
    readonly id: string;
    readonly dedupeKey: string;
}

export interface SocketDisconnectNotice {
    readonly code: string;
    readonly message: string;
}

export interface ClientToServerEvents {
    readonly typing: (isTyping: boolean) => void;
}

export interface ServerToClientEvents {
    readonly 'online-users': (users: readonly SocketPresenceUser[]) => void;
    readonly 'user-typing': (payload: SocketTypingEvent) => void;
    readonly 'new-message': (message: object) => void;
    readonly 'message-updated': (message: object) => void;
    readonly 'notification-created': (notification: object) => void;
    readonly 'notification-removed': (payload: SocketNotificationRemoval) => void;
    readonly 'notifications-read': () => void;
    readonly 'session-disconnected': (notice: SocketDisconnectNotice) => void;
}

export interface InterServerEvents {
    readonly ping: () => void;
}

export interface ChoirSocketData {
    auth: SocketAuthenticatedContext;
}

export type ChoirSocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    ChoirSocketData
>;

export type ChoirSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    ChoirSocketData
>;
