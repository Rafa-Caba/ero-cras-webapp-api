// src/scripts/backupDatabase.ts

import { connectDatabase, disconnectDatabase } from '../config/database';
import { backupCurrentDatabase } from '../services/databaseBackup.service';

const run = async (): Promise<void> => {
    await connectDatabase();

    try {
        const backupDirectory = await backupCurrentDatabase();
        console.log(`Database backup completed: ${backupDirectory}`);
    } finally {
        await disconnectDatabase();
    }
};

run().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
