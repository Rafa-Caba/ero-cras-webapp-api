// Added 'media' to the list
export const VALID_MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'MEDIA', 'REACTION', 'AUDIO', 'VIDEO'];

// Added mobile audio formats: m4a, aac, 3gp, ogg
export const ALLOWED_MEDIA_EXTENSIONS = [
    // Audio
    'mp3', 'wav', 'm4a', 'aac', '3gp', 'ogg', 'caf',
    // Video
    'mp4', 'mov', 'webm', 'avi', 'mkv',
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    // Documents
    'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'
];