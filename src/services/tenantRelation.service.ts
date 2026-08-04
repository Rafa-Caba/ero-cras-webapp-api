// src/services/tenantRelation.service.ts

import type { Model, Types } from 'mongoose';
import { AppError } from '../errors/AppError';

interface TenantRelationDocument {
    readonly choirId?: Types.ObjectId | null;
}

const createTenantRelationError = (fieldName: string): AppError => {
    return new AppError(
        404,
        'TENANT_RELATION_NOT_FOUND',
        `${fieldName} must reference an existing resource from the same choir`
    );
};

export const assertSameChoirRelation = async <
    TDocument extends TenantRelationDocument
>(
    relationModel: Model<TDocument>,
    relationId: Types.ObjectId | null | undefined,
    choirId: Types.ObjectId,
    fieldName: string
): Promise<void> => {
    if (!relationId) {
        return;
    }

    const relatedDocument = await relationModel
        .findById(relationId)
        .select('choirId')
        .lean()
        .exec();

    if (
        !relatedDocument ||
        !relatedDocument.choirId ||
        !relatedDocument.choirId.equals(choirId)
    ) {
        throw createTenantRelationError(fieldName);
    }
};

export const assertSameChoirRelations = async <
    TDocument extends TenantRelationDocument
>(
    relationModel: Model<TDocument>,
    relationIds: readonly Types.ObjectId[],
    choirId: Types.ObjectId,
    fieldName: string
): Promise<void> => {
    const uniqueRelationIds = [
        ...new Map(
            relationIds.map((relationId) => [relationId.toString(), relationId])
        ).values()
    ];

    await Promise.all(
        uniqueRelationIds.map((relationId) =>
            assertSameChoirRelation(
                relationModel,
                relationId,
                choirId,
                fieldName
            )
        )
    );
};
