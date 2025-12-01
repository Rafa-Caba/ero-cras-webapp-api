import mongoose, { Query } from 'mongoose';

export const applyPopulateAuthors = <T>(query: Query<T[], any>) => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};

export const applyPopulateSingleAuthor = <T>(query: Query<T | null, any>) => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};