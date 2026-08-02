// src/services/tenantRelation.service.ts

import type { Model, Types } from 'mongoose';

interface TenantRelationDocument {
    readonly choirId?: Types.ObjectId | null;
}

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

    if (!relatedDocument || !relatedDocument.choirId) {
        throw new Error(`${fieldName} does not reference an existing tenant resource`);
    }

    if (!relatedDocument.choirId.equals(choirId)) {
        throw new Error(`${fieldName} must reference a resource from the same choir`);
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
