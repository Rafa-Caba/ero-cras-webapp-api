// src/types/audit.types.ts

import type { StoredJsonObject } from './content.types';
import type { UserRole } from './roles.types';

export interface AuditUserSummary {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly role: UserRole;
}

export interface AuditLogResponse {
    readonly id: string;
    readonly action: string;
    readonly operation: string;
    readonly collectionName: string;
    readonly referenceId: string;
    readonly actorUserId: string;
    readonly actor: AuditUserSummary | null;
    readonly actorRole: UserRole | null;
    readonly targetChoirId: string;
    readonly targetUserId: string | null;
    readonly targetUser: AuditUserSummary | null;
    readonly description: string;
    readonly before: StoredJsonObject | null;
    readonly after: StoredJsonObject | null;
    readonly changes: StoredJsonObject;
    readonly ipAddress: string;
    readonly userAgent: string;
    readonly deviceId: string;
    readonly timestamp: string;
    readonly createdAt: string;
}
