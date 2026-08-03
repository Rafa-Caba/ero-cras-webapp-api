// src/types/sync.types.ts

export interface SyncQuery {
    readonly updatedSince: Date | null;
}

export interface UpdatedSinceFilter {
    readonly updatedAt?: {
        readonly $gt: Date;
    };
}
