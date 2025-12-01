export const extractTextFromTiptap = (content: any): string => {
    if (typeof content === 'string') return content;

    if (!content || typeof content !== 'object') return '';

    let text = '';

    const traverse = (nodes: any[]) => {
        if (!Array.isArray(nodes)) return;

        nodes.forEach((node) => {
            if (node.type === 'text' && typeof node.text === 'string') {
                text += node.text;
            } else if (node.type === 'hardBreak') {
                text += '\n';
            } else if (node.content) {
                traverse(node.content);
                if (node.type === 'paragraph' || node.type === 'heading') {
                    text += '\n';
                }
            }
        });
    };

    if (content.content) {
        traverse(content.content);
    }

    return text.trim() || 'Sent a message';
};