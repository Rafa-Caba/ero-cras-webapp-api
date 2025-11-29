import { Server, Socket } from 'socket.io';

interface ConnectedUser {
    socketId: string;
    id: string;
    name: string;
    username: string;
    imageUrl?: string;
}

export const configuringSockets = (io: Server) => {
    // In-memory list of connected users
    // Note: In a multi-server setup (scaling), you would use Redis for this.
    let connectedUsers: ConnectedUser[] = [];

    io.on('connection', (socket: Socket) => {
        // 1. Register User on Connect
        const user = socket.handshake.auth?.user;
        
        if (user) {
            const newUser: ConnectedUser = {
                socketId: socket.id,
                id: user.id || user._id,
                name: user.name || user.nombre,
                username: user.username,
                imageUrl: user.imageUrl || user.fotoPerfilUrl
            };

            // Add to list
            connectedUsers.push(newUser);
            console.log(`🟢 User Connected: ${newUser.username} (${socket.id})`);

            // Broadcast updated list to ALL clients
            io.emit('online-users', connectedUsers);
        }

        // 2. Handle Typing
        socket.on('typing', (isTyping: boolean) => {
            if (user) {
                // Broadcast to everyone EXCEPT the sender
                socket.broadcast.emit('user-typing', {
                    username: user.username,
                    isTyping
                });
            }
        });

        // 3. Handle Disconnect
        socket.on('disconnect', () => {
            console.log(`🔴 Socket Disconnected: ${socket.id}`);
            
            // Remove user from list
            connectedUsers = connectedUsers.filter(u => u.socketId !== socket.id);
            
            // Broadcast new list
            io.emit('online-users', connectedUsers);
        });
    });
};