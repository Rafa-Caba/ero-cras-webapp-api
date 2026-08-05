// scripts/production-regressions.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    'utf8'
);

const changedSources = [
    'src/config/database.ts',
    'src/controllers/announcement.controller.ts',
    'src/controllers/blog.controller.ts',
    'src/controllers/user.controller.ts',
    'src/middlewares/requestTiming.ts',
    'src/services/media.service.ts',
    'src/server.ts',
    'src/socket.ts',
    'src/utils/logger.ts',
    'src/utils/notificationHelper.ts'
];

for (const relativePath of changedSources) {
    const source = read(relativePath);
    assert.match(source, /^\/\//u, `${relativePath} must start with its file path comment`);
    assert.doesNotMatch(source, /\bas any\b/u, `${relativePath} must not use as any`);
    assert.doesNotMatch(source, /:\s*any\b/u, `${relativePath} must not use any`);
    assert.doesNotMatch(source, /<any>/u, `${relativePath} must not use any generics`);
    assert.doesNotMatch(source, /@ts-ignore/u, `${relativePath} must not suppress TypeScript errors`);
}

const database = read('src/config/database.ts');
const blogController = read('src/controllers/blog.controller.ts');
const announcementController = read('src/controllers/announcement.controller.ts');
const userController = read('src/controllers/user.controller.ts');
const requestTiming = read('src/middlewares/requestTiming.ts');
const server = read('src/server.ts');
const socket = read('src/socket.ts');
const logger = read('src/utils/logger.ts');
const notificationHelper = read('src/utils/notificationHelper.ts');
const mediaService = read('src/services/media.service.ts');

assert.match(database, /maxPoolSize: 20/u);
assert.match(database, /minPoolSize: 2/u);
assert.match(requestTiming, /SLOW_REQUEST_THRESHOLD_MS = 750/u);
assert.match(server, /requestTimingMiddleware/u);
assert.match(server, /keepAliveTimeout = 75_000/u);
assert.match(server, /path: '\/socket\.io'/u);
assert.match(server, /connectTimeout: 45_000/u);
assert.match(server, /transports: \['polling', 'websocket'\]/u);
assert.match(server, /perMessageDeflate: false/u);
assert.match(socket, /Socket transport upgraded/u);
assert.match(socket, /forwardedFor/u);
assert.match(logger, /void Log\.create/u);
assert.match(notificationHelper, /void deliverCommunityNotification/u);
assert.match(blogController, /await post\.populate\('author'/u);
assert.match(announcementController, /await announcement\.populate\('createdBy'/u);
assert.match(announcementController, /await announcement\.populate\('updatedBy'/u);
assert.match(userController, /\.limit\(500\)/u);
assert.match(userController, /\.maxTimeMS\(5_000\)/u);
assert.match(mediaService, /file\.buffer\.length <= 0/u);
assert.match(mediaService, /stream\.end\(file\.buffer\)/u);
assert.match(mediaService, /uploadPlatformProfileMedia/u);
assert.match(mediaService, /platform\/users/u);
assert.match(userController, /platformUploaded/u);
assert.match(userController, /deleteCloudinaryMedia/u);

console.log('Production and performance regression API contract tests passed.');
