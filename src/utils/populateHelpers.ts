import mongoose, { Query } from 'mongoose';

/**
 * Applies populate for "createdBy" and "updatedBy" fields
 */
export const applyPopulateAutores = <T>(query: Query<T[], any>) => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};

export const applyPopulateAutorSingle = <T>(query: Query<T | null, any>) => {
    return query
        .populate('createdBy', 'name username')
        .populate('updatedBy', 'name username');
};