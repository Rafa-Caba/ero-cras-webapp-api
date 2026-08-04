// src/types/auth.types.ts

import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
import type { UserRole } from './roles.types';

export interface AccessTokenClaims extends JwtPayload {
    readonly sub: string;
    readonly sv: number;
    readonly typ: 'access';
    readonly jti: string;
}

export interface RefreshTokenClaims extends JwtPayload {
    readonly sub: string;
    readonly sv: number;
    readonly typ: 'refresh';
    readonly jti: string;
}

export interface AuthenticatedUser {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly email: string;
    readonly role: UserRole;
    readonly choirId: string | null;
    readonly preferredChoirId: string | null;
    readonly isActive: boolean;
    readonly mustChangePassword: boolean;
    readonly sessionVersion: number;
}

export interface AuthenticatedChoir {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly isActive: boolean;
}

export interface AuthenticatedContext {
    readonly tokenId: string;
    readonly user: AuthenticatedUser;
    readonly choir: AuthenticatedChoir | null;
    readonly targetChoir: AuthenticatedChoir | null;
    readonly effectiveChoirId: string | null;
}

export interface RequestWithUser extends Request {
    authToken?: AccessTokenClaims;
    auth?: AuthenticatedContext;
    user?: AuthenticatedUser;
}

export type AuthenticatedRequest = RequestWithUser;

export interface SessionTokenPair {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly refreshTokenId: string;
    readonly refreshTokenHash: string;
    readonly refreshTokenExpiresAt: Date;
}

export interface AuthSessionResponse {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly sessionId: string;
    readonly user: AuthenticatedUser;
    readonly choir: AuthenticatedChoir | null;
    readonly requiresPasswordChange: boolean;
}
