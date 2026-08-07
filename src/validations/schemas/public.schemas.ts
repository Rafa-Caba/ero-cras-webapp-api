// src/validations/schemas/public.schemas.ts

import { AppError } from '../../errors/AppError';

export interface PublicChoirParams {
    readonly choirCode: string;
}

export interface PublicBlogParams extends PublicChoirParams {
    readonly postId: string;
}

export const parsePublicChoirCode = (value: string): string => {
    const normalizedValue = value.trim().toLowerCase();
    const codePattern = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

    if (!codePattern.test(normalizedValue)) {
        throw new AppError(
            400,
            'INVALID_CHOIR_CODE',
            'choirCode may only contain lowercase letters, numbers, and internal hyphens'
        );
    }

    return normalizedValue;
};
