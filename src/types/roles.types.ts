// src/types/roles.types.ts

export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'EDITOR'
    | 'USER'
    | 'VIEWER';

export const USER_ROLES: readonly UserRole[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'EDITOR',
    'USER',
    'VIEWER'
];

export const TENANT_ROLES: readonly UserRole[] = [
    'ADMIN',
    'EDITOR',
    'USER',
    'VIEWER'
];



export const isUserRole = (role: string): role is UserRole => {
    return USER_ROLES.some((allowedRole) => allowedRole === role);
};

export const isTenantRole = (role: UserRole): boolean => {
    return TENANT_ROLES.includes(role);
};
