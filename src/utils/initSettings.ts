import Settings from "../models/Settings.";

export const ensureSettingsExists = async () => {
    const count = await Settings.countDocuments();
    if (count === 0) {
        const newSettings = new Settings();
        await newSettings.save();
        console.log('🌟 Se creó un documento de configuración inicial');
    }
};