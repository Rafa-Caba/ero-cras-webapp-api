// src/scripts/syncIndexes.ts

import { connectDatabase, disconnectDatabase } from '../config/database';
import { syncApplicationIndexes } from '../services/indexSync.service';

const run = async (): Promise<void> => {
    await connectDatabase();

    try {
        const results = await syncApplicationIndexes();

        for (const result of results) {
            const droppedIndexes = result.droppedIndexes.length > 0
                ? result.droppedIndexes.join(', ')
                : 'none';

            console.log(
                `${result.modelName}: synchronized; dropped indexes: ${droppedIndexes}`
            );
        }
    } finally {
        await disconnectDatabase();
    }
};

run().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
