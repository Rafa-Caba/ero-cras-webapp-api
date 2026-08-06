// src/types/notification.types.ts

export const NOTIFICATION_CATEGORIES = ['CHAT', 'BLOG'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export const NOTIFICATION_TYPES = [
    'CHAT_MESSAGE',
    'CHAT_REACTION',
    'BLOG_POST',
    'BLOG_COMMENT',
    'BLOG_REACTION'
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];
