import Settings from "../models/Settings";

export const ensureSettingsExists = async () => {
    try {
        const count = await Settings.countDocuments();
        if (count === 0) {
            const newSettings = new Settings();
            await newSettings.save();
            // console.log('🌟 Initial Settings document created.');
        }
    } catch (error) {
        console.error('Error initializing settings:', error);
    }
};