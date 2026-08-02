// src/types/http.types.ts

export interface ApiMessageResponse {
    readonly message: string;
}

export interface ApiErrorResponse {
    readonly message: string;
    readonly code: string;
    readonly details?: {
        readonly [key: string]: string;
    };
}
