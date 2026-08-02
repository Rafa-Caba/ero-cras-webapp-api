// src/types/request.types.ts

export type RequestValue = string | number | boolean | object | null | undefined;

export type RequestBody = Record<string, RequestValue>;

export interface PaginationQuery {
    readonly page?: string;
    readonly limit?: string;
    readonly all?: string;
}

export interface PaginationResult {
    readonly page: number;
    readonly limit: number;
    readonly skip: number;
}
