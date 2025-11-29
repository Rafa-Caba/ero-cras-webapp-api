import User from '../models/User';
import { sendPushNotification } from './pushNotifications';

const extractPreview = (content: any): string => {
    try {
        if (content?.type === 'doc' && Array.isArray(content.content)) {
            const firstNode = content.content[0];
            if (firstNode?.content?.[0]?.text) {
                return firstNode.content[0].text;
            }
        }
        return '';
    } catch (e) { return ''; }
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
                        const text = extractPreview(item.content);
                        body = text || 'Mensaje recibido';
                    } else {
                        body = `Enviado a ${item.type.toLowerCase()}`; 
                    }
                    break;

                case 'ANNOUNCEMENT':
                    title = "📢 Nuevo Aviso!";
                    body = item.title || 'Revísalo en la app!';
                    data = { type: 'ANNOUNCEMENT', id: item._id };
                    break;

                case 'BLOG':
                    title = "📝 Nuevo Blog";
                    body = item.title || 'Lee la nueva historia';
                    data = { type: 'BLOG', id: item._id };
                    break;
            }

            // 3. Send
            console.log(`🔔 Notifying ${tokens.length} users about ${category}`);
            await sendPushNotification(tokens, title, body, data);
            
        } catch (error) {
            console.error("Notification Helper Error:", error);
        }
    })();
};