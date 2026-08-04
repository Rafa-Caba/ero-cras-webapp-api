// scripts/phase-14-16.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const logModel = read('src/models/Log.ts');
const logger = read('src/utils/logger.ts');
const auditTypes = read('src/types/audit.types.ts');
const logRoutes = read('src/routes/log.ts');
const choirController = read('src/controllers/choir.controller.ts');
const userController = read('src/controllers/user.controller.ts');
const server = read('src/server.ts');
const userModel = read('src/models/User.ts');
const userService = read('src/services/user.service.ts');
const choirService = read('src/services/choir.service.ts');

assert.match(logModel, /actorUserId/u);
assert.match(logModel, /actorRole/u);
assert.match(logModel, /targetChoirId/u);
assert.match(logModel, /targetUserId/u);
assert.match(logModel, /ipAddress/u);
assert.match(logModel, /timestamp/u);
assert.match(auditTypes, /actorUserId/u);
assert.match(auditTypes, /targetUserId/u);
assert.match(logger, /x-device-id/u);
assert.match(server, /app\.set\('trust proxy', 1\)/u);
assert.match(logRoutes, /'\/platform'/u);
assert.match(logRoutes, /requireRole\('SUPER_ADMIN'\)/u);
assert.match(choirController, /operation: 'choir.create'/u);
assert.match(choirController, /operation: 'choir.deactivate'/u);
assert.match(userController, /'user.role_change'/u);
assert.match(userController, /operation: 'user.password_reset'/u);
assert.match(userController, /operation: 'admin.users_access'/u);
assert.match(userController, /operation: 'platform.profile_update'/u);
assert.match(userModel, /preferredChoirId/u);
assert.match(userService, /PREFERRED_CHOIR_NOT_ALLOWED/u);
assert.match(userService, /PREFERRED_CHOIR_NOT_FOUND/u);
assert.match(choirService, /preferredChoirId: choir\._id/u);

console.log('Phase 14-16 API contract tests passed.');
