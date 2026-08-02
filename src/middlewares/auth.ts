// src/middlewares/auth.ts

import { authenticate } from './authenticate';
import { loadAuthenticatedUser } from './loadAuthenticatedUser';
import { requireActiveUser } from './requireActiveUser';
import { requireActiveChoir } from './requireActiveChoir';
import { requirePasswordChanged } from './requirePasswordChanged';
import {
    requireRouteTenantContext,
    resolveRouteTargetChoir,
    resolveTargetChoir
} from './resolveTargetChoir';
import { requireTenantContext } from './requireTenantContext';

export type {
    AuthenticatedRequest,
    RequestWithUser
} from '../types/auth.types';

export const verifySessionToken = [
    authenticate,
    loadAuthenticatedUser,
    requireActiveUser,
    requireActiveChoir
];

export const verifyPlatformToken = [
    ...verifySessionToken,
    requirePasswordChanged
];

export const verifyTenantToken = [
    ...verifyPlatformToken,
    resolveTargetChoir,
    requireTenantContext
];

const verifyToken = [
    ...verifyPlatformToken,
    resolveRouteTargetChoir,
    requireRouteTenantContext
];

export default verifyToken;
