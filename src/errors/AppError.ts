// src/errors/AppError.ts

export interface AppErrorDetails {
    readonly [key: string]: string;
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: AppErrorDetails;

    public constructor(
        statusCode: number,
        code: string,
        message: string,
        details?: AppErrorDetails
    ) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
