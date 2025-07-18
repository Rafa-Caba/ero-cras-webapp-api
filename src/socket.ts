import { Server } from 'socket.io';
import ChatMessage from './models/ChatMessage';

export const configurarSockets = (io: Server) => {
    io.on('connection', (socket) => {
        console.log('🟢 Usuario conectado al chat');

        socket.on('nuevo-mensaje', async (msgData) => {
            try {
                const nuevoMensaje = new ChatMessage(msgData);
                await nuevoMensaje.save();

                const populated = await nuevoMensaje.populate('autor', 'nombre username imagen');

                io.emit('mensaje-recibido', populated);
            } catch (error) {
                console.error('Error guardando mensaje:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('🔴 Usuario desconectado');
        });
    });
};
