import User from '../models/User';
import { sendPushNotification } from './pushNotifications';

const extractTextFromTiptap = (content: any): string => {
    if (typeof content === 'string') return content;

    if (!content || typeof content !== 'object') return '';

    let text = '';

    const traverse = (nodes: any[]) => {
        if (!Array.isArray(nodes)) return;

        nodes.forEach((node) => {
            if (node.type === 'text' && typeof node.text === 'string') {
                text += node.text;
            } else if (node.type === 'hardBreak') {
                text += '\n';
            } else if (node.content) {
                traverse(node.content);
                if (node.type === 'paragraph') text += '\n';
            }
        });
    };

    if (content.content) {
        traverse(content.content);
    }

    return text.trim();
};

export const notifyCommunity = async (
    senderId: string | undefined,
    senderName: string,
    category: 'CHAT' | 'ANNOUNCEMENT' | 'BLOG',
    item: any
) => {
    (async () => {
        try {
            const query: any = { pushToken: { $exists: true, $ne: null } };
            if (senderId) {
                query._id = { $ne: senderId };
            }

            const users = await User.find(query).select('pushToken');
            const tokens = users.map(u => u.pushToken as string).filter(t => t);

            if (tokens.length === 0) return;

            let title = '';
            let body = '';
            let data: any = {};

            switch (category) {
                case 'CHAT':
                    title = `Nuevo mensaje de ${senderName}`;
                    data = { type: 'CHAT', messageId: item._id };

                    if (item.type === 'TEXT') {
                        const text = extractTextFromTiptap(item.content);
                        body = text || 'Mensaje recibido';
                    } else {
                        body = `Enviado a ${item.type.toLowerCase()}`;
                    }
                    break;

                case 'ANNOUNCEMENT':
                    title = "📢 Nuevo Aviso!";
                    body = typeof item.title === 'string' ? item.title : 'Revísalo en la app!';
                    data = { type: 'ANNOUNCEMENT', id: item._id };
                    break;

                case 'BLOG':
                    title = "📝 Nuevo Blog";
                    body = typeof item.title === 'string' ? item.title : 'Lee la nueva historia';
                    data = { type: 'BLOG', id: item._id };
                    break;
            }

            console.log(`🔔 Notifying ${tokens.length} users about ${category}. Body preview: ${body.substring(0, 20)}...`);

            await sendPushNotification(tokens, title, body, data);

        } catch (error) {
            console.error("Notification Helper Error:", error);
        }
    })();
};