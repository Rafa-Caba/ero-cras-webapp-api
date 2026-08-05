// src/utils/populateHelpers.ts

import type { Query } from 'mongoose';

export const applyPopulateAuthors = <TDocument>(
    query: Query<TDocument[], TDocument>
): Query<TDocument[], TDocument> => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};

export const applyPopulateSingleAuthor = <TDocument>(
    query: Query<TDocument | null, TDocument>
): Query<TDocument | null, TDocument> => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};
