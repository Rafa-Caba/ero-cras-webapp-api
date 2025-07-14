import mongoose from 'mongoose';
import { Query } from 'mongoose';

/**
 * Aplica populate para campos "creadoPor" y "actualizadoPor" si existen en el schema
 */
export const applyPopulateAutores = <T>(query: Query<T[], any>) => {
    return query
        .populate('creadoPor', 'nombre username')
        .populate('actualizadoPor', 'nombre username');
};

export const applyPopulateAutorSingle = <T>(query: Query<T | null, any>) => {
    return query
        .populate('creadoPor', 'nombre username')
        .populate('actualizadoPor', 'nombre username');
};