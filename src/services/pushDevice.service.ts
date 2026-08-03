// src/services/pushDevice.service.ts

import { Types } from 'mongoose';
import PushDevice, { type IPushDevice } from '../models/PushDevice';
import type { RegisterPushDeviceInput } from '../types/push.types';

export const registerPushDevice = async (
    userId: Types.ObjectId,
    choirId: Types.ObjectId,
    input: RegisterPushDeviceInput
): Promise<IPushDevice> => {
    await PushDevice.updateMany(
        {
            expoPushToken: input.expoPushToken,
            $or: [
                { userId: { $ne: userId } },
                { choirId: { $ne: choirId } },
                { deviceId: { $ne: input.deviceId } }
            ],
            isActive: true
        },
        {
            $set: {
                isActive: false,
                invalidatedAt: new Date(),
                invalidationReason: 'Push token reassigned to another device context'
            }
        }
    );

    return PushDevice.findOneAndUpdate(
        { userId, choirId, deviceId: input.deviceId },
        {
            $set: {
                expoPushToken: input.expoPushToken,
                platform: input.platform,
                deviceName: input.deviceName ?? '',
                appVersion: input.appVersion ?? '',
                isActive: true,
                registeredAt: new Date(),
                lastSeenAt: new Date(),
                invalidatedAt: null,
                invalidationReason: ''
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).orFail().exec();
};

export const listOwnPushDevices = async (
    userId: Types.ObjectId,
    choirId: Types.ObjectId
): Promise<readonly IPushDevice[]> => {
    return PushDevice.find({ userId, choirId, isActive: true })
        .sort({ lastSeenAt: -1 });
};

export const unregisterPushDevice = async (
    userId: Types.ObjectId,
    deviceId: string,
    choirId?: Types.ObjectId
): Promise<void> => {
    const filter: {
        userId: Types.ObjectId;
        deviceId: string;
        isActive: boolean;
        choirId?: Types.ObjectId;
    } = {
        userId,
        deviceId,
        isActive: true
    };

    if (choirId) {
        filter.choirId = choirId;
    }

    await PushDevice.updateMany(filter, {
        $set: {
            isActive: false,
            invalidatedAt: new Date(),
            invalidationReason: 'Device unregistered'
        }
    });
};

export const unregisterAllUserPushDevices = async (
    userId: Types.ObjectId,
    reason: string
): Promise<void> => {
    await PushDevice.updateMany(
        { userId, isActive: true },
        {
            $set: {
                isActive: false,
                invalidatedAt: new Date(),
                invalidationReason: reason
            }
        }
    );
};

export const unregisterChoirPushDevices = async (
    choirId: Types.ObjectId,
    reason: string
): Promise<void> => {
    await PushDevice.updateMany(
        { choirId, isActive: true },
        {
            $set: {
                isActive: false,
                invalidatedAt: new Date(),
                invalidationReason: reason
            }
        }
    );
};

export const invalidatePushDevice = async (
    pushDeviceId: Types.ObjectId,
    reason: string
): Promise<void> => {
    await PushDevice.updateOne(
        { _id: pushDeviceId },
        {
            $set: {
                isActive: false,
                invalidatedAt: new Date(),
                invalidationReason: reason
            }
        }
    );
};
