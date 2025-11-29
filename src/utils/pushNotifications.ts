import axios from 'axios';

interface PushMessage {
    to: string | string[];
    sound: string;
    title: string;
    body: string;
    data?: any;
}

export const sendPushNotification = async (tokens: string[], title: string, body: string, data: any = {}) => {
    const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));

    if (validTokens.length === 0) return;

    const message: PushMessage = {
        to: validTokens,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        await axios.post('https://exp.host/--/api/v2/push/send', message, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        console.log(`🚀 Notification sent to ${validTokens.length} devices.`);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
};