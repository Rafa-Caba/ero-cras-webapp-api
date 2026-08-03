// src/services/expoPush.service.ts

import axios from 'axios';
import { Types } from 'mongoose';
import { env } from '../config/env';
import PushDevice, { type IPushDevice } from '../models/PushDevice';
import PushReceipt from '../models/PushReceipt';
import User from '../models/User';
import type {
    PushNotificationContent,
    PushNotificationData
} from '../types/push.types';
import { invalidatePushDevice } from './pushDevice.service';

interface ExpoPushMessage {
    readonly to: string;
    readonly sound: 'default';
    readonly title: string;
    readonly body: string;
    readonly data: PushNotificationData;
}

interface ExpoPushTicketDetails {
    readonly error?: string;
}

interface ExpoPushTicket {
    readonly status: 'ok' | 'error';
    readonly id?: string;
    readonly message?: string;
    readonly details?: ExpoPushTicketDetails;
}

interface ExpoPushTicketResponse {
    readonly data: readonly ExpoPushTicket[];
}

interface ExpoPushReceiptDetails {
    readonly error?: string;
}

interface ExpoPushReceiptValue {
    readonly status: 'ok' | 'error';
    readonly message?: string;
    readonly details?: ExpoPushReceiptDetails;
}

interface ExpoPushReceiptResponse {
    readonly data: Record<string, ExpoPushReceiptValue>;
}

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_BATCH_SIZE = 100;
const EXPO_REQUEST_TIMEOUT_MS = 10000;
const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECEIPT_ATTEMPTS = 8;

const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    };

    if (env.expoPush.accessToken) {
        headers.Authorization = `Bearer ${env.expoPush.accessToken}`;
    }

    return headers;
};

const chunk = <T>(items: readonly T[], size: number): readonly T[][] => {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
};

const saveTicket = async (
    device: IPushDevice,
    ticket: ExpoPushTicket
): Promise<void> => {
    if (ticket.status === 'error') {
        if (ticket.details?.error === 'DeviceNotRegistered') {
            await invalidatePushDevice(
                device._id,
                'Expo reported DeviceNotRegistered'
            );
        }
        return;
    }

    if (!ticket.id) {
        return;
    }

    const now = Date.now();
    await PushReceipt.updateOne(
        { ticketId: ticket.id },
        {
            $setOnInsert: {
                ticketId: ticket.id,
                pushDeviceId: device._id,
                status: 'PENDING',
                attempts: 0,
                nextAttemptAt: new Date(now + env.expoPush.receiptDelayMs),
                expiresAt: new Date(now + RECEIPT_RETENTION_MS)
            }
        },
        { upsert: true }
    );
};

export const sendPushToDevices = async (
    devices: readonly IPushDevice[],
    content: PushNotificationContent
): Promise<void> => {
    const activeDevices = devices.filter(
        (device) => device.isActive && device.expoPushToken.length > 0
    );

    for (const deviceBatch of chunk(activeDevices, EXPO_BATCH_SIZE)) {
        const messages: readonly ExpoPushMessage[] = deviceBatch.map(
            (device) => ({
                to: device.expoPushToken,
                sound: 'default',
                title: content.title,
                body: content.body,
                data: content.data
            })
        );

        const response = await axios.post<ExpoPushTicketResponse>(
            EXPO_SEND_URL,
            messages,
            {
                headers: buildHeaders(),
                timeout: EXPO_REQUEST_TIMEOUT_MS
            }
        );

        await Promise.all(
            deviceBatch.map((device, index) => {
                const ticket = response.data.data[index];
                return ticket ? saveTicket(device, ticket) : Promise.resolve();
            })
        );
    }
};

const processReceiptValue = async (
    receiptDocumentId: Types.ObjectId,
    pushDeviceId: Types.ObjectId,
    receipt: ExpoPushReceiptValue
): Promise<void> => {
    if (receipt.status === 'ok') {
        await PushReceipt.updateOne(
            { _id: receiptDocumentId },
            {
                $set: {
                    status: 'DELIVERED',
                    processedAt: new Date(),
                    errorCode: '',
                    errorMessage: ''
                }
            }
        );
        return;
    }

    const errorCode = receipt.details?.error ?? 'EXPO_RECEIPT_ERROR';

    if (errorCode === 'DeviceNotRegistered') {
        await invalidatePushDevice(
            pushDeviceId,
            'Expo receipt reported DeviceNotRegistered'
        );
    }

    await PushReceipt.updateOne(
        { _id: receiptDocumentId },
        {
            $set: {
                status: 'ERROR',
                processedAt: new Date(),
                errorCode,
                errorMessage: receipt.message ?? 'Expo push receipt error'
            }
        }
    );
};

let receiptProcessorRunning = false;

export const processPendingPushReceipts = async (): Promise<void> => {
    if (receiptProcessorRunning) {
        return;
    }

    receiptProcessorRunning = true;

    try {
        const pending = await PushReceipt.find({
            status: 'PENDING',
            nextAttemptAt: { $lte: new Date() }
        })
            .sort({ nextAttemptAt: 1 })
            .limit(300);

        if (pending.length === 0) {
            return;
        }

        const response = await axios.post<ExpoPushReceiptResponse>(
            EXPO_RECEIPTS_URL,
            { ids: pending.map((receipt) => receipt.ticketId) },
            {
                headers: buildHeaders(),
                timeout: EXPO_REQUEST_TIMEOUT_MS
            }
        );

        await Promise.all(pending.map(async (receiptDocument) => {
            const receipt = response.data.data[receiptDocument.ticketId];

            if (receipt) {
                await processReceiptValue(
                    receiptDocument._id,
                    receiptDocument.pushDeviceId,
                    receipt
                );
                return;
            }

            receiptDocument.attempts += 1;

            if (receiptDocument.attempts >= MAX_RECEIPT_ATTEMPTS) {
                receiptDocument.status = 'EXPIRED';
                receiptDocument.processedAt = new Date();
            } else {
                receiptDocument.nextAttemptAt = new Date(
                    Date.now() + env.expoPush.receiptIntervalMs
                );
            }

            await receiptDocument.save();
        }));
    } finally {
        receiptProcessorRunning = false;
    }
};

let processorStarted = false;

export const startPushReceiptProcessor = (): void => {
    if (processorStarted) {
        return;
    }

    processorStarted = true;
    const interval = setInterval(() => {
        processPendingPushReceipts().catch((error: Error) => {
            console.error('Push receipt processing failed:', error.message);
        });
    }, env.expoPush.receiptIntervalMs);

    interval.unref();
};

export const findActiveChoirDevices = async (
    choirId: Types.ObjectId,
    excludedUserId?: Types.ObjectId
): Promise<readonly IPushDevice[]> => {
    const userFilter: {
        choirId: Types.ObjectId;
        isActive: boolean;
        _id?: { $ne: Types.ObjectId };
    } = {
        choirId,
        isActive: true
    };

    if (excludedUserId) {
        userFilter._id = { $ne: excludedUserId };
    }

    const activeUsers = await User.find(userFilter).select('_id').exec();
    const activeUserIds = activeUsers.map((user) => user._id);

    return PushDevice.find({
        choirId,
        userId: { $in: activeUserIds },
        isActive: true
    })
        .select('+expoPushToken')
        .exec();
};
