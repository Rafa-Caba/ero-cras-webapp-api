// src/services/socketAuth.service.ts

import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import Choir from '../models/Choir';
import User from '../models/User';
import type { RequestBody, RequestValue } from '../types/request.types';
import type {
    ChoirSocket,
    SocketAuthenticatedContext
} from '../types/socket.types';
import { verifyAccessToken } from './token.service';

const readOptionalAuthString = (
    body: RequestBody,
    fieldName: string
): string | undefined => {
    const value: RequestValue = body[fieldName];

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== 'string' || !value.trim()) {
        throw new AppError(
            400,
            'INVALID_SOCKET_AUTH',
            `${fieldName} must be a non-empty string`
        );
    }

    return value.trim();
};

const readAccessToken = (body: RequestBody): string => {
    const accessToken =
        readOptionalAuthString(body, 'accessToken') ??
        readOptionalAuthString(body, 'token');

    if (!accessToken) {
        throw new AppError(
            401,
            'SOCKET_ACCESS_TOKEN_REQUIRED',
            'Socket authentication requires an access token'
        );
    }

    return accessToken;
};

const resolveTenantChoirId = async (
    userChoirId: Types.ObjectId | null | undefined,
    requestedTargetChoirId: string | undefined
): Promise<Types.ObjectId> => {
    if (requestedTargetChoirId) {
        throw new AppError(
            403,
            'TENANT_SOCKET_TARGET_FORBIDDEN',
            'Tenant users cannot select a socket choir context'
        );
    }

    if (!userChoirId) {
        throw new AppError(
            403,
            'SOCKET_CHOIR_CONTEXT_REQUIRED',
            'The authenticated user does not have a choir assignment'
        );
    }

    return userChoirId;
};

const resolvePlatformTargetChoirId = (
    requestedTargetChoirId: string | undefined
): Types.ObjectId => {
    if (!requestedTargetChoirId) {
        throw new AppError(
            400,
            'SOCKET_TARGET_CHOIR_REQUIRED',
            'SUPER_ADMIN socket connections require targetChoirId'
        );
    }

    if (!Types.ObjectId.isValid(requestedTargetChoirId)) {
        throw new AppError(
            400,
            'INVALID_SOCKET_TARGET_CHOIR',
            'targetChoirId must be a valid MongoDB ObjectId'
        );
    }

    return new Types.ObjectId(requestedTargetChoirId);
};

export const authenticateSocketConnection = async (
    socket: ChoirSocket
): Promise<SocketAuthenticatedContext> => {
    const authBody: RequestBody = socket.handshake.auth;
    const tokenClaims = verifyAccessToken(readAccessToken(authBody));
    const requestedTargetChoirId = readOptionalAuthString(
        authBody,
        'targetChoirId'
    );
    const user = await User.findById(tokenClaims.sub);

    if (!user) {
        throw new AppError(
            401,
            'SOCKET_USER_NOT_FOUND',
            'The authenticated socket user no longer exists'
        );
    }

    if (user.sessionVersion !== tokenClaims.sv) {
        throw new AppError(
            401,
            'SOCKET_SESSION_REVOKED',
            'The socket session has been revoked'
        );
    }

    if (!user.isActive) {
        throw new AppError(
            403,
            'SOCKET_USER_INACTIVE',
            'The authenticated socket user is inactive'
        );
    }

    if (user.mustChangePassword) {
        throw new AppError(
            403,
            'SOCKET_PASSWORD_CHANGE_REQUIRED',
            'The password must be changed before connecting to chat'
        );
    }

    const choirId = user.role === 'SUPER_ADMIN'
        ? resolvePlatformTargetChoirId(requestedTargetChoirId)
        : await resolveTenantChoirId(user.choirId, requestedTargetChoirId);
    const choir = await Choir.findOne({ _id: choirId, isActive: true })
        .select('_id');

    if (!choir) {
        throw new AppError(
            403,
            'SOCKET_CHOIR_INACTIVE',
            'The selected socket choir does not exist or is inactive'
        );
    }

    return {
        tokenId: tokenClaims.jti,
        user: {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            imageUrl: user.imageUrl ?? '',
            role: user.role,
            choirId: choir._id.toString()
        }
    };
};
