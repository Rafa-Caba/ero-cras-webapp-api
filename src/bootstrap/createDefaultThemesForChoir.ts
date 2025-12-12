import { Types } from 'mongoose';
import Theme from '../models/Theme';

export async function createDefaultThemesForChoir(choirId: Types.ObjectId) {
    const existingCount = await Theme.countDocuments({ choirId });
    if (existingCount > 0) return;

    const lightTheme = {
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
    };

    const darkTheme = {
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
    };

    await Theme.insertMany([lightTheme, darkTheme]);
}
