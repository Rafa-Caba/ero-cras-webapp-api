// src/utils/extractTextFromTiptap.ts

import type { TipTapContent, TipTapNode } from '../types/tiptap.types';

const appendNodeText = (nodes: readonly TipTapNode[], chunks: string[]): void => {
    for (const node of nodes) {
        if (node.type === 'text' && node.text) {
            chunks.push(node.text);
            continue;
        }

        if (node.type === 'hardBreak') {
            chunks.push('\n');
            continue;
        }

        if (node.content) {
            appendNodeText(node.content, chunks);

            if (node.type === 'paragraph' || node.type === 'heading') {
                chunks.push('\n');
            }
        }
    }
};

export const extractTextFromTiptap = (content: TipTapContent): string => {
    if (typeof content === 'string') {
        return content;
    }

    if (!content?.content) {
        return '';
    }

    const chunks: string[] = [];
    appendNodeText(content.content, chunks);
    return chunks.join('').trim() || 'Sent a message';
};
