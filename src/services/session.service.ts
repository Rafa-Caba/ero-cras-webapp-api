// src/services/session.service.ts

import { Types } from 'mongoose';
import RefreshToken from '../models/RefreshToken';
import User from '../models/User';

export const revokeAllUserSessions = async (
    userId: string | Types.ObjectId
): Promise<void> => {
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { sessionVersion: 1 } },
        { new: true }
    );

    if (!updatedUser) {
        return;
    }

    await RefreshToken.updateMany(
        {
            userId: updatedUser._id,
            revokedAt: null
        },
        {
            $set: { revokedAt: new Date() }
        }
    );
};
