// src/types/media.types.ts

export const MEDIA_OWNER_TYPES = [
    'USER',
    'MEMBER',
    'GALLERY',
    'BLOG',
    'ANNOUNCEMENT',
    'CHAT',
    'SONG',
    'CHOIR',
    'SETTINGS',
    'INSTRUMENT'
] as const;

export type MediaOwnerType = typeof MEDIA_OWNER_TYPES[number];

export const MEDIA_RESOURCE_TYPES = ['image', 'video', 'raw'] as const;
export type MediaResourceType = typeof MEDIA_RESOURCE_TYPES[number];

export const MEDIA_ASSET_STATUSES = [
    'PENDING',
    'ATTACHED',
    'ORPHANED',
    'DELETED'
] as const;

export type MediaAssetStatus = typeof MEDIA_ASSET_STATUSES[number];

export const MEDIA_UPLOAD_CATEGORIES = [
    'users',
    'members',
    'gallery',
    'blog',
    'announcements',
    'chat',
    'songs',
    'choir-logo',
    'settings-logo',
    'instruments'
] as const;

export type MediaUploadCategory = typeof MEDIA_UPLOAD_CATEGORIES[number];

export interface UploadedMediaReference {
    readonly assetId: string;
    readonly url: string;
    readonly publicId: string;
    readonly resourceType: MediaResourceType;
    readonly bytes: number;
    readonly format: string;
}

export interface MediaFieldSnapshot {
    readonly assetId?: string | null;
    readonly publicId?: string | null;
    readonly resourceType?: MediaResourceType | null;
}
