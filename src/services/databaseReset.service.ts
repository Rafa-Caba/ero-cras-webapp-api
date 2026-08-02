// src/services/databaseReset.service.ts

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import Choir from '../models/Choir';
import PlatformState from '../models/PlatformState';
import User from '../models/User';
import {
    createDefaultInstrumentsForChoir,
    createDefaultThemesForChoir,
    ensureDefaultSettingsForChoir
} from './choirDefaults.service';
import { syncApplicationIndexes } from './indexSync.service';
import type { UserRole } from '../types/roles.types';
import { backupCurrentDatabase } from './databaseBackup.service';

const REQUIRED_RESET_CONFIRMATION = 'RESET_CHOIR_DATABASE';
const CREDENTIALS_OUTPUT_DIRECTORY = path.resolve('seed-output');
const CREDENTIALS_OUTPUT_FILE = path.join(
    CREDENTIALS_OUTPUT_DIRECTORY,
    'seed-credentials.local.json'
);

interface SeedCredential {
    readonly choirCode: string | null;
    readonly role: UserRole;
    readonly username: string;
    readonly email: string;
    readonly password: string;
}

interface SeedUserDefinition {
    readonly role: Exclude<UserRole, 'SUPER_ADMIN'>;
    readonly name: string;
    readonly username: string;
    readonly email: string;
}

const TENANT_SEED_USERS: readonly SeedUserDefinition[] = [
    {
        role: 'ADMIN',
        name: 'Seed Admin',
        username: 'admin',
        email: 'admin@seed.local'
    },
    {
        role: 'EDITOR',
        name: 'Seed Editor',
        username: 'editor',
        email: 'editor@seed.local'
    },
    {
        role: 'USER',
        name: 'Seed User',
        username: 'user',
        email: 'user@seed.local'
    },
    {
        role: 'VIEWER',
        name: 'Seed Viewer',
        username: 'viewer',
        email: 'viewer@seed.local'
    }
];

const generatePassword = (): string => {
    return `Aa1!${randomBytes(18).toString('base64url')}`;
};

const verifyResetPermission = (): void => {
    if (env.nodeEnv === 'production') {
        throw new AppError(
            403,
            'PRODUCTION_RESET_BLOCKED',
            'Database reset is blocked when NODE_ENV is production'
        );
    }

    if (!env.databaseReset.enabled) {
        throw new AppError(
            403,
            'DATABASE_RESET_DISABLED',
            'Set ALLOW_DATABASE_RESET=true to enable the reset script'
        );
    }

    if (
        env.databaseReset.confirmation !== REQUIRED_RESET_CONFIRMATION
    ) {
        throw new AppError(
            403,
            'DATABASE_RESET_CONFIRMATION_REQUIRED',
            `DATABASE_RESET_CONFIRMATION must equal ${REQUIRED_RESET_CONFIRMATION}`
        );
    }
};

const createTenantUsers = async (
    choirId: mongoose.Types.ObjectId,
    choirCode: string
): Promise<readonly SeedCredential[]> => {
    const credentials: SeedCredential[] = [];

    for (const definition of TENANT_SEED_USERS) {
        const password = generatePassword();
        const passwordHash = await bcrypt.hash(password, 12);

        await User.create({
            name: `${definition.name} ${choirCode.toUpperCase()}`,
            username: definition.username,
            usernameNormalized: definition.username,
            email: definition.email,
            emailNormalized: definition.email,
            password: passwordHash,
            role: definition.role,
            choirId,
            isActive: true,
            mustChangePassword: true,
            passwordChangedAt: new Date(),
            sessionVersion: 1
        });

        credentials.push({
            choirCode,
            role: definition.role,
            username: definition.username,
            email: definition.email,
            password
        });
    }

    return credentials;
};

const writeCredentials = async (
    credentials: readonly SeedCredential[]
): Promise<void> => {
    await mkdir(CREDENTIALS_OUTPUT_DIRECTORY, { recursive: true });
    await writeFile(
        CREDENTIALS_OUTPUT_FILE,
        `${JSON.stringify(credentials, null, 2)}\n`,
        'utf8'
    );
};

const clearCurrentDatabase = async (): Promise<void> => {
    const database = mongoose.connection.db;

    if (!database) {
        throw new AppError(
            500,
            'DATABASE_NOT_CONNECTED',
            'A database connection is required before clearing application data'
        );
    }

    const collections = await database
        .listCollections({}, { nameOnly: true })
        .toArray();

    for (const collectionInfo of collections) {
        if (collectionInfo.name.startsWith('system.')) {
            continue;
        }

        await database.collection(collectionInfo.name).deleteMany({});
    }
};

export interface ResetAndSeedResult {
    readonly backupDirectory: string;
    readonly credentialsFile: string;
}

export const resetAndSeedDatabase = async (): Promise<ResetAndSeedResult> => {
    verifyResetPermission();

    const backupDirectory = await backupCurrentDatabase();
    await clearCurrentDatabase();

    await syncApplicationIndexes();

    const [choirA, choirB] = await Choir.create([
        {
            name: 'Coro A',
            code: 'coro-a',
            description: 'Tenant controlado para pruebas cruzadas',
            isActive: true
        },
        {
            name: 'Coro B',
            code: 'coro-b',
            description: 'Tenant controlado para pruebas cruzadas',
            isActive: true
        }
    ]);

    await Promise.all([
        ensureDefaultSettingsForChoir(choirA._id),
        ensureDefaultSettingsForChoir(choirB._id),
        createDefaultThemesForChoir(choirA._id),
        createDefaultThemesForChoir(choirB._id),
        createDefaultInstrumentsForChoir(choirA._id),
        createDefaultInstrumentsForChoir(choirB._id)
    ]);

    const superAdminPassword = generatePassword();
    const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 12);

    const superAdmin = await User.create({
        name: 'Platform Super Admin',
        username: 'superadmin',
        usernameNormalized: 'superadmin',
        email: 'superadmin@seed.local',
        emailNormalized: 'superadmin@seed.local',
        password: superAdminPasswordHash,
        role: 'SUPER_ADMIN',
        choirId: null,
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        sessionVersion: 1,
        platformAccountKey: 'seed-super-admin'
    });

    await PlatformState.create({
        key: 'platform',
        superAdminBootstrapCompletedAt: new Date(),
        superAdminBootstrapUserId: superAdmin._id
    });

    const choirACredentials = await createTenantUsers(
        choirA._id,
        choirA.code
    );
    const choirBCredentials = await createTenantUsers(
        choirB._id,
        choirB.code
    );

    await writeCredentials([
        {
            choirCode: null,
            role: 'SUPER_ADMIN',
            username: 'superadmin',
            email: 'superadmin@seed.local',
            password: superAdminPassword
        },
        ...choirACredentials,
        ...choirBCredentials
    ]);

    return {
        backupDirectory,
        credentialsFile: CREDENTIALS_OUTPUT_FILE
    };
};
