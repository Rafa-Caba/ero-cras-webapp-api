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
    'src/controllers/chat.controller.ts',
    'src/controllers/notification.controller.ts',
    'src/controllers/songType.controller.ts',
    'src/models/ChatMessage.ts',
    'src/models/BlogPost.ts',
    'src/models/Notification.ts',
    'src/models/Choir.ts',
    'src/routes/chat.ts',
    'src/routes/notification.ts',
    'src/validations/schemas/common.schemas.ts',
    'src/validations/schemas/resource.schemas.ts',
    'src/controllers/user.controller.ts',
    'src/middlewares/requestTiming.ts',
    'src/services/media.service.ts',
    'src/services/notification.service.ts',
    'src/server.ts',
    'src/services/indexSync.service.ts',
    'src/socket.ts',
    'src/utils/constants.ts',
    'src/utils/logger.ts',
    'src/utils/notificationHelper.ts',
    'src/types/tiptap.types.ts',
    'src/types/notification.types.ts',
    'src/utils/extractTextFromTiptap.ts',
    'src/utils/normalizeUser.ts',
    'src/utils/populateHelpers.ts'
];

for (const relativePath of changedSources) {
    const source = read(relativePath);
    assert.match(source, /^\/\//u, `${relativePath} must start with its file path comment`);
    assert.doesNotMatch(source, /\bas any\b/u, `${relativePath} must not use as any`);
    assert.doesNotMatch(source, /:\s*any\b/u, `${relativePath} must not use any`);
    assert.doesNotMatch(source, /<any>/u, `${relativePath} must not use any generics`);
    assert.doesNotMatch(source, /\bunknown\b/u, `${relativePath} must not use unknown`);
    assert.doesNotMatch(source, /@ts-ignore/u, `${relativePath} must not suppress TypeScript errors`);
}

const database = read('src/config/database.ts');
const blogController = read('src/controllers/blog.controller.ts');
const chatController = read('src/controllers/chat.controller.ts');
const chatModel = read('src/models/ChatMessage.ts');
const chatRoutes = read('src/routes/chat.ts');
const choirModel = read('src/models/Choir.ts');
const constants = read('src/utils/constants.ts');
const songTypeController = read('src/controllers/songType.controller.ts');
const announcementController = read('src/controllers/announcement.controller.ts');
const userController = read('src/controllers/user.controller.ts');
const requestTiming = read('src/middlewares/requestTiming.ts');
const server = read('src/server.ts');
const socket = read('src/socket.ts');
const logger = read('src/utils/logger.ts');
const notificationHelper = read('src/utils/notificationHelper.ts');
const mediaService = read('src/services/media.service.ts');

const notificationController = read('src/controllers/notification.controller.ts');
const notificationModel = read('src/models/Notification.ts');
const notificationRoutes = read('src/routes/notification.ts');
const notificationService = read('src/services/notification.service.ts');
const notificationTypes = read('src/types/notification.types.ts');
const indexSync = read('src/services/indexSync.service.ts');
const blogModel = read('src/models/BlogPost.ts');
const commonSchemas = read('src/validations/schemas/common.schemas.ts');
const resourceSchemas = read('src/validations/schemas/resource.schemas.ts');

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
assert.match(songTypeController, /serializeSongType/u);
assert.match(songTypeController, /parentId: songType\.parentId\?\.toString\(\) \?\? null/u);
assert.match(songTypeController, /input\.parentId !== undefined/u);
assert.doesNotMatch(songTypeController, /populate\('parentId'/u);
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
assert.match(commonSchemas, /readOptionalContent/u);
assert.match(resourceSchemas, /type === 'TEXT' \|\| type === 'REACTION' \|\| type === 'STICKER'/u);
assert.match(resourceSchemas, /readOptionalContent\(body, 'content'\) \?\? ''/u);
assert.match(commonSchemas, /readRequiredStringArray/u);
assert.match(chatController, /markChatReceiptsController/u);
assert.match(chatController, /deliveredTo: \[actorUserId\]/u);
assert.match(chatController, /readBy: \[actorUserId\]/u);
assert.match(chatModel, /deliveredTo/u);
assert.match(chatModel, /readBy/u);
assert.match(chatModel, /'STICKER'/u);
assert.match(chatModel, /const ChatMessage = model<IChatMessage>\('ChatMessage'/u);
assert.match(choirModel, /export interface IChoir/u);
assert.match(choirModel, /export const normalizeChoirCode/u);
assert.match(choirModel, /const Choir = model<IChoir>\('Choir'/u);
assert.doesNotMatch(choirModel, /model<IChatMessage>\('ChatMessage'/u);
assert.match(chatRoutes, /'\/receipts'/u);

assert.match(chatController, /getChatMessageDetailsController/u);
assert.match(chatController, /recipientUserIds/u);
assert.match(chatController, /deliveryReceipts/u);
assert.match(chatController, /readReceipts/u);
assert.match(chatController, /findActiveChoirRecipientIds/u);
assert.match(chatController, /CHAT_REACTION/u);
assert.match(chatModel, /recipientUserIds/u);
assert.match(chatModel, /deliveryReceipts/u);
assert.match(chatModel, /readReceipts/u);
assert.match(chatRoutes, /\/:messageId\/details/u);
assert.match(notificationTypes, /BLOG_REACTION/u);
assert.match(notificationModel, /notification_recipient_dedupe_unique/u);
assert.match(notificationService, /createChoirNotifications/u);
assert.match(notificationService, /user:\$\{notification\.recipientUserId/u);
assert.match(notificationController, /markNotificationsReadController/u);
assert.match(notificationRoutes, /\/read-all/u);
assert.match(server, /\/api\/notifications/u);
assert.match(indexSync, /Notification\.syncIndexes/u);
assert.match(blogController, /BLOG_COMMENT/u);
assert.match(blogController, /BLOG_REACTION/u);
assert.match(blogModel, /authorUserId/u);
assert.match(socket, /user:\$\{user\.id\}/u);
assert.match(chatController, /author: actorUserId/u);
assert.match(notificationService, /removeResourceNotifications/u);
assert.match(notificationService, /\$set:\s*\{/u);
assert.match(blogController, /removeResourceNotifications/u);
assert.match(constants, /'STICKER'/u);

console.log('Production and performance regression API contract tests passed.');
