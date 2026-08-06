// scripts/media-storage-regressions.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    'utf8'
);

const sourceFiles = [
    'src/controllers/chat.controller.ts',
    'src/models/ChatMessage.ts',
    'src/routes/chat.ts'
];

for (const relativePath of sourceFiles) {
    const source = read(relativePath);
    assert.match(source, /^\/\//u, `${relativePath} must start with its file path comment`);
    assert.doesNotMatch(source, /\bas any\b/u, `${relativePath} must not use as any`);
    assert.doesNotMatch(source, /:\s*any\b/u, `${relativePath} must not use any`);
    assert.doesNotMatch(source, /<any>/u, `${relativePath} must not use any generics`);
    assert.doesNotMatch(source, /\bunknown\b/u, `${relativePath} must not use unknown`);
    assert.doesNotMatch(source, /@ts-ignore/u, `${relativePath} must not suppress TypeScript errors`);
}

const controller = read('src/controllers/chat.controller.ts');
const model = read('src/models/ChatMessage.ts');
const routes = read('src/routes/chat.ts');

assert.match(controller, /listChatMediaController/u);
assert.match(controller, /type: \{ \$in: \['IMAGE', 'FILE', 'MEDIA', 'AUDIO', 'VIDEO'\] \}/u);
assert.match(controller, /path: 'mediaAssetId'/u);
assert.match(controller, /url originalName mimeType bytes format resourceType/u);
assert.match(controller, /\.populate\(chatMediaPopulate\)/u);
assert.match(routes, /router\.get\('\/media', verifyTenantToken, listChatMediaController\)/u);
assert.match(model, /ChatMessageSchema\.index\(\{ choirId: 1, type: 1, createdAt: -1 \}\)/u);

console.log('Multimedia and storage API regression contract tests passed.');
