import Theme from "../models/Theme";

const initialThemes = [
    {
        name: 'Default',
        isDark: false,
        primaryColor: '#ead4ff',
        accentColor: '#cfaef9',
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        cardColor: '#f3e3fb',
        buttonColor: '#a966ff',
        navColor: '#f3e3fb',
        buttonTextColor: '#FFFFFF',
        secondaryTextColor: '#666666',
        borderColor: '#cfaef9'
    },
    {
        name: 'Dark',
        isDark: true,
        primaryColor: '#1c0f2e',
        accentColor: '#7b4fa6',
        backgroundColor: '#121212',
        textColor: '#FFFFFF',
        cardColor: '#2e1a4d',
        buttonColor: '#8a36f8',
        navColor: '#271c3a',
        buttonTextColor: '#FFFFFF',
        secondaryTextColor: '#AAAAAA',
        borderColor: '#3c2666'
    },
    {
        name: 'Light',
        isDark: false,
        primaryColor: '#FFFFFF',
        accentColor: '#dcc1fb',
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        cardColor: '#f8f2ff',
        buttonColor: '#C392DB',
        navColor: '#f4edff',
        buttonTextColor: '#000000',
        secondaryTextColor: '#555555',
        borderColor: '#e4d4f9'
    }
];

export const createDefaultThemes = async () => {
    try {
        const existing = await Theme.find({ name: { $in: initialThemes.map(t => t.name) } });

        if (existing.length === initialThemes.length) {
            // console.log('🟡 All default themes exist.');
            return;
        }

        for (const theme of initialThemes) {
            const exists = existing.find(e => e.name === theme.name);
            if (!exists) {
                await Theme.create(theme);
                // console.log(`✅ Theme "${theme.name}" created.`);
            }
        }
    } catch (error) {
        console.error("Error creating default themes:", error);
    }
};