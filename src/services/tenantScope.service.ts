// src/services/tenantScope.service.ts

import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import type { RequestWithUser } from '../types/auth.types';
import type {
    TenantFilter,
    TenantOwnedResource,
    TenantResourceFilter
} from '../types/tenant.types';
import { parseObjectId } from '../validations/schemas/common.schemas';

export const requireEffectiveChoirId = (req: RequestWithUser): string => {
    const effectiveChoirId = req.auth?.effectiveChoirId;

    if (!effectiveChoirId) {
        throw new AppError(
            403,
            'TENANT_CONTEXT_REQUIRED',
            'A valid choir context is required for this operation'
        );
    }

    return effectiveChoirId;
};

export const requireEffectiveChoirObjectId = (
    req: RequestWithUser
): Types.ObjectId => {
    return parseObjectId(requireEffectiveChoirId(req), 'effectiveChoirId');
};

export const buildTenantFilter = (req: RequestWithUser): TenantFilter => {
    return { choirId: requireEffectiveChoirObjectId(req) };
};

export const buildTenantResourceFilter = (
    resourceId: string,
    choirId: Types.ObjectId
): TenantResourceFilter => {
    return {
        _id: parseObjectId(resourceId, 'resourceId'),
        choirId
    };
};

export const createTenantResourceNotFoundError = (
    errorCode: string,
    errorMessage: string
): AppError => {
    return new AppError(404, errorCode, errorMessage);
};

export const requireTenantOwnership = (
    resource: TenantOwnedResource,
    choirId: Types.ObjectId
): void => {
    if (!resource.choirId.equals(choirId)) {
        throw new AppError(
            404,
            'TENANT_RESOURCE_NOT_FOUND',
            'The requested resource was not found'
        );
    }
};

export const requireAuthenticatedUserId = (
    req: RequestWithUser
): Types.ObjectId => {
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated user has not been loaded'
        );
    }

    return parseObjectId(userId, 'authenticatedUserId');
};
