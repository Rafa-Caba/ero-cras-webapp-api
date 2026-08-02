// src/scripts/resetAndSeed.ts

import { connectDatabase, disconnectDatabase } from '../config/database';
import { resetAndSeedDatabase } from '../services/databaseReset.service';

const run = async (): Promise<void> => {
    await connectDatabase();

    try {
        const result = await resetAndSeedDatabase();
        console.log('Database reset and seed completed successfully.');
        console.log(`Backup directory: ${result.backupDirectory}`);
        console.log(`Local seed credentials: ${result.credentialsFile}`);
    } finally {
        await disconnectDatabase();
    }
};

run().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
