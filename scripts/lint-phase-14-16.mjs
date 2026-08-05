// scripts/lint-phase-14-16.mjs

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const targets = [
    'src/controllers/choir.controller.ts',
    'src/controllers/log.controller.ts',
    'src/controllers/user.controller.ts',
    'src/models/Log.ts',
    'src/middlewares/authenticateSocket.ts',
    'src/middlewares/cloudinaryStorage.ts',
    'src/services/media.service.ts',
    'src/models/User.ts',
    'src/routes/log.ts',
    'src/server.ts',
    'src/socket.ts',
    'src/services/auth.service.ts',
    'src/services/choir.service.ts',
    'src/services/user.service.ts',
    'src/services/tenantRelation.service.ts',
    'src/types/audit.types.ts',
    'src/types/auth.types.ts',
    'src/types/user.types.ts',
    'src/utils/logger.ts',
    'src/validations/schemas/user.schemas.ts',
    'src/config/database.ts',
    'src/controllers/announcement.controller.ts',
    'src/controllers/blog.controller.ts',
    'src/middlewares/requestTiming.ts',
    'src/utils/notificationHelper.ts',
];

const prohibitedPatterns = [
    { label: 'explicit any type', expression: /\bany\b/u },
    { label: 'unsafe any assertion', expression: /as\s+any\b/u },
    { label: 'TypeScript ignore directive', expression: /@ts-ignore/u },
    { label: 'TypeScript expect-error directive', expression: /@ts-expect-error/u },
    { label: 'untyped external value', expression: new RegExp(`\\b${'un' + 'known'}\\b`, 'u') }
];

const failures = [];

for (const relativePath of targets) {
    const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

    for (const pattern of prohibitedPatterns) {
        if (pattern.expression.test(source)) {
            failures.push(`${relativePath}: ${pattern.label}`);
        }
    }
}

if (failures.length > 0) {
    console.error('Phase 14-16 lint failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`Phase 14-16 lint passed for ${targets.length} API files.`);
