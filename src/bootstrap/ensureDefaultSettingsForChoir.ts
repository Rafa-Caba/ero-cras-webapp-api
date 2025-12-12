import { Types } from 'mongoose';
import Settings from '../models/Settings';

export async function ensureDefaultSettingsForChoir(choirId: Types.ObjectId) {
    const existing = await Settings.findOne({ choirId });
    if (existing) return existing;

    const settings = await Settings.create({
        choirId,
        webTitle: 'Nuevo Coro',
        contactPhone: '',
        logoUrl: '',
        socials: {
            facebook: '',
            instagram: '',
            youtube: '',
            whatsapp: '',
            email: ''
        },
        homeLegends: {
            principal: 'Bienvenido a nuestro coro',
            secondary: 'Próximamente más información.'
        },
        history: {
            type: 'doc',
            content: []
        }
    });

    return settings;
}
