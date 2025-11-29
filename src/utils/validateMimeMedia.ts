import { ALLOWED_MEDIA_EXTENSIONS } from "./constants";

export function isValidMediaExtension(filename: string): boolean {
    if (!filename) return false;
    
    const parts = filename.toLowerCase().split('.');
    if (parts.length < 2) return false;

    const ext = parts[parts.length - 1];
    return ALLOWED_MEDIA_EXTENSIONS.includes(ext);
}