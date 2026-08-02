// src/services/choirDefaults.service.ts

import { Types } from 'mongoose';
import Settings from '../models/Settings';
import Theme from '../models/Theme';

export const ensureDefaultSettingsForChoir = async (
    choirId: Types.ObjectId
) => {
    const existingSettings = await Settings.findOne({ choirId });

    if (existingSettings) {
        return existingSettings;
    }

    return Settings.create({
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
};

export const createDefaultThemesForChoir = async (
    choirId: Types.ObjectId
): Promise<void> => {
    const existingCount = await Theme.countDocuments({ choirId });

    if (existingCount > 0) {
        return;
    }

    await Theme.insertMany([
        {
            name: 'Light',
            isDark: false,
            primaryColor: '#EAD4FF',
            accentColor: '#CFA5FF',
            backgroundColor: '#FFFFFF',
            textColor: '#111827',
            cardColor: '#F9FAFB',
            buttonColor: '#7C3AED',
            navColor: '#F3E8FF',
            buttonTextColor: '#FFFFFF',
            secondaryTextColor: '#4B5563',
            borderColor: '#E5E7EB',
            choirId
        },
        {
            name: 'Dark',
            isDark: true,
            primaryColor: '#7C3AED',
            accentColor: '#C4B5FD',
            backgroundColor: '#020617',
            textColor: '#F9FAFB',
            cardColor: '#020617',
            buttonColor: '#6366F1',
            navColor: '#020617',
            buttonTextColor: '#FFFFFF',
            secondaryTextColor: '#9CA3AF',
            borderColor: '#1F2937',
            choirId
        }
    ]);
};
