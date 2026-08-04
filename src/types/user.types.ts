// src/types/user.types.ts

import type { UserRole } from './roles.types';

export type TenantUserRole = Exclude<UserRole, 'SUPER_ADMIN'>;

export interface CreateUserInput {
    readonly name: string;
    readonly username: string;
    readonly email: string;
    readonly role: TenantUserRole;
    readonly temporaryPassword?: string;
    readonly instrumentId?: string | null;
    readonly instrumentLabel?: string;
    readonly voice: boolean;
    readonly bio?: string;
}

export interface UpdateUserInput {
    readonly name?: string;
    readonly username?: string;
    readonly email?: string;
    readonly role?: TenantUserRole;
    readonly instrumentId?: string | null;
    readonly instrumentLabel?: string;
    readonly voice?: boolean;
    readonly bio?: string;
}

export interface UpdateProfileInput {
    readonly name?: string;
    readonly username?: string;
    readonly email?: string;
    readonly instrumentId?: string | null;
    readonly instrumentLabel?: string;
    readonly voice?: boolean;
    readonly bio?: string;
    readonly preferredChoirId?: string | null;
}

export interface UserResponse {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly email: string;
    readonly role: UserRole;
    readonly imageUrl: string;
    readonly instrumentId: string | null;
    readonly instrumentLabel: string;
    readonly voice: boolean;
    readonly bio: string;
    readonly themeId: string | null;
    readonly choirId: string | null;
    readonly preferredChoirId: string | null;
    readonly isActive: boolean;
    readonly mustChangePassword: boolean;
    readonly lastAccess: Date | null;
    readonly createdAt: Date | null;
    readonly updatedAt: Date | null;
}
