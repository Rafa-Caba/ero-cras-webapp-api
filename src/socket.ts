import { Server, Socket } from 'socket.io';

interface ConnectedUser {
    socketId: string;
    id: string;
    name: string;
    username: string;
    imageUrl?: string;
    choirId: string;
    role?: string;
}

const getChoirRoom = (choirId: string) => `choir:${choirId}`;

export const configuringSockets = (io: Server): void => {
    let connectedUsers: ConnectedUser[] = [];

    io.on('connection', (socket: Socket) => {
        const user = socket.handshake.auth?.user;

        if (user) {
            const choirId: string =
                user.choirId || user.choirId?._id || user.choir || 'global';

            const newUser: ConnectedUser = {
                socketId: socket.id,
                id: (user.id || user._id || '').toString(),
                name: user.name || user.nombre || 'Usuario',
                username: user.username,
                imageUrl: user.imageUrl || user.fotoPerfilUrl,
                choirId,
                role: user.role,
            };

            const choirRoom = getChoirRoom(choirId);

            socket.join(choirRoom);

            // Track connected user
            connectedUsers.push(newUser);

            console.log(
                `🟢 User Connected: ${newUser.username} (${socket.id}) [choir=${choirId}]`
            );

            const choirUsers = connectedUsers.filter(
                (u) => u.choirId === choirId
            );
            io.to(choirRoom).emit('online-users', choirUsers);
        } else {
            console.log(`⚪ Socket connected without user info: ${socket.id}`);
        }

        socket.on('typing', (isTyping: boolean) => {
            if (!user) return;

            const choirId: string =
                user.choirId || user.choirId?._id || user.choir || 'global';
            const choirRoom = getChoirRoom(choirId);

            socket.to(choirRoom).emit('user-typing', {
                username: user.username,
                isTyping,
            });
        });

        socket.on('disconnect', () => {
            console.log(`🔴 Socket Disconnected: ${socket.id}`);

            const disconnectedUser = connectedUsers.find(
                (u) => u.socketId === socket.id
            );

            connectedUsers = connectedUsers.filter(
                (u) => u.socketId !== socket.id
            );

            if (disconnectedUser) {
                const choirRoom = getChoirRoom(disconnectedUser.choirId);
                const choirUsers = connectedUsers.filter(
                    (u) => u.choirId === disconnectedUser.choirId
                );

                io.to(choirRoom).emit('online-users', choirUsers);
            } else {
                console.log(
                    `ℹ️ Disconnected socket had no stored user: ${socket.id}`
                );
            }
        });
    });
};
