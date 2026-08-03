// src/types/push.types.ts

export const PUSH_PLATFORMS = ['IOS', 'ANDROID'] as const;
export type PushPlatform = typeof PUSH_PLATFORMS[number];

export const PUSH_RECEIPT_STATUSES = [
    'PENDING',
    'DELIVERED',
    'ERROR',
    'EXPIRED'
] as const;

export type PushReceiptStatus = typeof PUSH_RECEIPT_STATUSES[number];

export interface RegisterPushDeviceInput {
    readonly deviceId: string;
    readonly expoPushToken: string;
    readonly platform: PushPlatform;
    readonly deviceName?: string;
    readonly appVersion?: string;
}

export interface PushNotificationData {
    readonly [key: string]: string;
}

export interface PushNotificationContent {
    readonly title: string;
    readonly body: string;
    readonly data: PushNotificationData;
}
