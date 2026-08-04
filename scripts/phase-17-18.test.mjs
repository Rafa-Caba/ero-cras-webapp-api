// scripts/phase-17-18.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    'utf8'
);

const tenantRelations = read('src/services/tenantRelation.service.ts');
const restSuite = read('scripts/qa/phase-17-api.sh');
const socketSuite = read('scripts/qa/phase-17-socket.mjs');
const productionEnv = read('.env.production.example');
const packageJson = JSON.parse(read('package.json'));

assert.match(tenantRelations, /TENANT_RELATION_NOT_FOUND/u);
assert.match(tenantRelations, /new AppError\(\s*404/u);
assert.match(restSuite, /curl/u);
assert.match(restSuite, /jq/u);
assert.match(restSuite, /CROSS_CHOIR_ACCESS_DENIED/u);
assert.match(restSuite, /LAST_ACTIVE_ADMIN_REQUIRED/u);
assert.match(restSuite, /REFRESH_TOKEN_REVOKED/u);
assert.match(socketSuite, /TENANT_SOCKET_TARGET_FORBIDDEN/u);
assert.match(socketSuite, /SOCKET_TARGET_CHOIR_REQUIRED/u);
assert.match(socketSuite, /new-message/u);
assert.match(productionEnv, /ALLOW_SUPER_ADMIN_BOOTSTRAP=false/u);
assert.match(productionEnv, /ALLOW_DATABASE_RESET=false/u);
assert.equal(packageJson.devDependencies['socket.io-client'], '^4.8.1');

console.log('Phase 17-18 API contract tests passed.');
