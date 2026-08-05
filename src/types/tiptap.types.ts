// src/types/tiptap.types.ts

export interface TipTapNode {
    readonly type: string;
    readonly text?: string;
    readonly content?: readonly TipTapNode[];
}

export interface TipTapDocument extends TipTapNode {
    readonly type: 'doc';
    readonly content: readonly TipTapNode[];
}

export type TipTapContent = string | TipTapDocument | TipTapNode | null | undefined;
