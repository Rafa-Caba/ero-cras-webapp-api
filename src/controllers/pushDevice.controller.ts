// src/controllers/pushDevice.controller.ts

import type { Response } from 'express';
import type { IPushDevice } from '../models/PushDevice';
import {
    listOwnPushDevices,
    registerPushDevice,
    unregisterPushDevice
} from '../services/pushDevice.service';
import {
    requireAuthenticatedUserId,
    requireEffectiveChoirObjectId
} from '../services/tenantScope.service';
import type { RequestWithUser } from '../types/auth.types';
import { parseRegisterPushDeviceInput } from '../validations/schemas/push.schemas';

interface DeviceParams {
    readonly deviceId: string;
}

const serializeDevice = (device: IPushDevice) => ({
    id: device._id.toString(),
    deviceId: device.deviceId,
    platform: device.platform,
    deviceName: device.deviceName ?? '',
    appVersion: device.appVersion ?? '',
    registeredAt: device.registeredAt,
    lastSeenAt: device.lastSeenAt
});

export const registerPushDeviceController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const device = await registerPushDevice(
        requireAuthenticatedUserId(req),
        requireEffectiveChoirObjectId(req),
        parseRegisterPushDeviceInput(req)
    );

    res.status(201).json({ device: serializeDevice(device) });
};

export const listPushDevicesController = async (
    req: RequestWithUser,
    res: Response
): Promise<void> => {
    const devices = await listOwnPushDevices(
        requireAuthenticatedUserId(req),
        requireEffectiveChoirObjectId(req)
    );

    res.json({ devices: devices.map(serializeDevice) });
};

export const unregisterPushDeviceController = async (
    req: RequestWithUser & { params: DeviceParams },
    res: Response
): Promise<void> => {
    await unregisterPushDevice(
        requireAuthenticatedUserId(req),
        req.params.deviceId,
        requireEffectiveChoirObjectId(req)
    );

    res.json({ message: 'Push device unregistered successfully' });
};
