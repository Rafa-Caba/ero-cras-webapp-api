// src/types/content.types.ts

export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
    [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type StoredJsonValue = JsonPrimitive | object;

export type StoredJsonObject = object;
