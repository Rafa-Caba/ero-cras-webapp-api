// src/middlewares/resolveTargetChoir.ts

import type { NextFunction, Response } from 'express';
import { AppError } from '../errors/AppError';
import Choir from '../models/Choir';
import { serializeChoir } from '../services/auth.service';
import type { RequestWithUser } from '../types/auth.types';
import { parseTargetChoirHeader } from '../validations/schemas/tenant.schemas';

type TenantSelectorValue =
    | string
    | number
    | boolean
    | object
    | null;

interface TenantSelectorBody {
    readonly choirId?: TenantSelectorValue;
    readonly choirKey?: TenantSelectorValue;
}

interface TenantRequest extends RequestWithUser {
    body: TenantSelectorBody | undefined;
}

const isPlatformAuthenticationRoute = (req: TenantRequest): boolean => {
    if (
        req.baseUrl === '/api/auth' ||
        req.baseUrl === '/api/choirs' ||
        req.baseUrl === '/api/logs'
    ) {
        return true;
    }

    if (req.baseUrl === '/api/users') {
        return req.path === '/me' || req.path.startsWith('/me/');
    }

    return false;
};

const validateTenantSelector = (
    selectorValue: TenantSelectorValue | undefined,
    selectorName: string,
    expectedChoirId: string,
    expectedChoirCode: string
): void => {
    if (selectorValue === undefined || selectorValue === null) {
        return;
    }

    if (typeof selectorValue !== 'string') {
        throw new AppError(
            400,
            'INVALID_TENANT_SELECTOR',
            `${selectorName} must contain exactly one string value`
        );
    }

    const normalizedSelector = selectorValue.trim().toLowerCase();

    if (!normalizedSelector) {
        throw new AppError(
            400,
            'INVALID_TENANT_SELECTOR',
            `${selectorName} cannot be empty`
        );
    }

    if (
        normalizedSelector !== expectedChoirId.toLowerCase() &&
        normalizedSelector !== expectedChoirCode.toLowerCase()
    ) {
        throw new AppError(
            403,
            'TENANT_SELECTOR_MISMATCH',
            'The request choir selector does not match the authenticated tenant context'
        );
    }
};

const validateRequestTenantSelectors = (
    req: TenantRequest,
    expectedChoirId: string,
    expectedChoirCode: string
): void => {
    const queryChoirId = req.query.choirId;
    const queryChoirKey = req.query.choirKey;

    validateTenantSelector(
        queryChoirId,
        'query.choirId',
        expectedChoirId,
        expectedChoirCode
    );
    validateTenantSelector(
        queryChoirKey,
        'query.choirKey',
        expectedChoirId,
        expectedChoirCode
    );
    validateTenantSelector(
        req.body?.choirId,
        'body.choirId',
        expectedChoirId,
        expectedChoirCode
    );
    validateTenantSelector(
        req.body?.choirKey,
        'body.choirKey',
        expectedChoirId,
        expectedChoirCode
    );
};

export const resolveTargetChoir = async (
    req: TenantRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user || !req.auth) {
        throw new AppError(
            500,
            'AUTH_PIPELINE_ERROR',
            'The authenticated context has not been initialized'
        );
    }

    const requestedChoirId = parseTargetChoirHeader(
        req.headers['x-target-choir-id']
    );

    if (req.user.role !== 'SUPER_ADMIN') {
        if (!req.auth.choir || !req.user.choirId) {
            throw new AppError(
                403,
                'CHOIR_CONTEXT_REQUIRED',
                'The authenticated user does not have a choir assignment'
            );
        }

        if (
            requestedChoirId &&
            requestedChoirId.toLowerCase() !== req.user.choirId.toLowerCase()
        ) {
            throw new AppError(
                403,
                'CROSS_CHOIR_ACCESS_DENIED',
                'Tenant users cannot select a different choir'
            );
        }

        validateRequestTenantSelectors(
            req,
            req.auth.choir.id,
            req.auth.choir.code
        );

        next();
        return;
    }

    if (!requestedChoirId) {
        throw new AppError(
            400,
            'TARGET_CHOIR_REQUIRED',
            'SUPER_ADMIN tenant operations require x-target-choir-id'
        );
    }

    const targetChoir = await Choir.findOne({
        _id: requestedChoirId,
        isActive: true
    });

    if (!targetChoir) {
        throw new AppError(
            404,
            'TARGET_CHOIR_NOT_FOUND',
            'The selected choir does not exist or is inactive'
        );
    }

    const serializedTargetChoir = serializeChoir(targetChoir);

    validateRequestTenantSelectors(
        req,
        serializedTargetChoir.id,
        serializedTargetChoir.code
    );

    req.auth = {
        ...req.auth,
        targetChoir: serializedTargetChoir,
        effectiveChoirId: serializedTargetChoir.id
    };

    req.user = {
        ...req.user,
        choirId: serializedTargetChoir.id
    };

    next();
};

export const resolveRouteTargetChoir = async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (isPlatformAuthenticationRoute(req)) {
        next();
        return;
    }

    await resolveTargetChoir(req, res, next);
};

export const requireRouteTenantContext = (
    req: TenantRequest,
    _res: Response,
    next: NextFunction
): void => {
    if (isPlatformAuthenticationRoute(req)) {
        next();
        return;
    }

    if (!req.auth?.effectiveChoirId) {
        throw new AppError(
            403,
            'TENANT_CONTEXT_REQUIRED',
            'A valid choir context is required for this operation'
        );
    }

    next();
};

