// scripts/production-regressions.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    'utf8'
);

const mediaService = read('src/services/media.service.ts');
const uploadMiddleware = read('src/middlewares/cloudinaryStorage.ts');
const socketServer = read('src/socket.ts');
const socketAuth = read('src/middlewares/authenticateSocket.ts');

assert.match(mediaService, /file\.buffer\.length <= 0/u);
assert.match(mediaService, /EMPTY_MEDIA_FILE/u);
assert.match(mediaService, /stream\.end\(file\.buffer\)/u);
assert.doesNotMatch(mediaService, /Readable\.from\(file\.buffer\)/u);
assert.match(mediaService, /MEDIA_PROVIDER_ERROR/u);
assert.match(mediaService, /error\.http_code === 400/u);
assert.match(uploadMiddleware, /image\/heic/u);
assert.match(uploadMiddleware, /image\/heif/u);
assert.match(socketServer, /Socket connected/u);
assert.match(socketServer, /Socket disconnected/u);
assert.match(socketAuth, /Socket authentication rejected/u);

console.log('Production regression API contract tests passed.');
