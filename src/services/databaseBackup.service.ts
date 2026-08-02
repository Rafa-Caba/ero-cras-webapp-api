// src/services/databaseBackup.service.ts

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';

const BACKUP_ROOT_DIRECTORY = path.resolve('backups');

const createTimestamp = (): string => {
    return new Date().toISOString().replace(/[:.]/g, '-');
};

export const backupCurrentDatabase = async (): Promise<string> => {
    const database = mongoose.connection.db;

    if (!database) {
        throw new AppError(
            500,
            'DATABASE_NOT_CONNECTED',
            'A database connection is required before creating a backup'
        );
    }

    const backupDirectory = path.join(
        BACKUP_ROOT_DIRECTORY,
        createTimestamp()
    );
    await mkdir(backupDirectory, { recursive: true });

    const collections = await database.listCollections().toArray();
    const backedUpCollections: string[] = [];

    for (const collectionInfo of collections) {
        if (collectionInfo.name.startsWith('system.')) {
            continue;
        }

        const documents = await database
            .collection(collectionInfo.name)
            .find({})
            .toArray();

        const collectionFile = path.join(
            backupDirectory,
            `${collectionInfo.name}.json`
        );

        await writeFile(
            collectionFile,
            `${JSON.stringify(documents, null, 2)}\n`,
            'utf8'
        );
        backedUpCollections.push(collectionInfo.name);
    }

    await writeFile(
        path.join(backupDirectory, 'manifest.json'),
        `${JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                databaseName: database.databaseName,
                collections: backedUpCollections
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    return backupDirectory;
};
