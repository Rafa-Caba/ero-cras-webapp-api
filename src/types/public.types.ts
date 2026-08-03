// src/types/public.types.ts

import type { Types } from 'mongoose';

export interface PublicChoirContext {
    readonly id: Types.ObjectId;
    readonly name: string;
    readonly code: string;
    readonly description: string;
    readonly logoUrl: string;
}
