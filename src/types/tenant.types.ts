// src/types/tenant.types.ts

import type { Types } from 'mongoose';

export interface TenantFilter {
    readonly choirId: Types.ObjectId;
}

export interface TenantResourceFilter extends TenantFilter {
    readonly _id: Types.ObjectId;
}

export interface TenantOwnedResource {
    readonly choirId: Types.ObjectId;
}
