// src/services/indexSync.service.ts

import Announcement from '../models/Announcement';
import BlogPost from '../models/BlogPost';
import ChatMessage from '../models/ChatMessage';
import Choir from '../models/Choir';
import GalleryImage from '../models/GalleryImage';
import Instrument from '../models/Instrument';
import Log from '../models/Log';
import Member from '../models/Member';
import PlatformState from '../models/PlatformState';
import RefreshToken from '../models/RefreshToken';
import Settings from '../models/Settings';
import Song from '../models/Song';
import SongType from '../models/SongType';
import Theme from '../models/Theme';
import User from '../models/User';

export interface IndexSyncResult {
    readonly modelName: string;
    readonly droppedIndexes: readonly string[];
}

export const syncApplicationIndexes = async (): Promise<readonly IndexSyncResult[]> => {
    const results = await Promise.all([
        Announcement.syncIndexes(),
        BlogPost.syncIndexes(),
        ChatMessage.syncIndexes(),
        Choir.syncIndexes(),
        GalleryImage.syncIndexes(),
        Instrument.syncIndexes(),
        Log.syncIndexes(),
        Member.syncIndexes(),
        PlatformState.syncIndexes(),
        RefreshToken.syncIndexes(),
        Settings.syncIndexes(),
        Song.syncIndexes(),
        SongType.syncIndexes(),
        Theme.syncIndexes(),
        User.syncIndexes()
    ]);

    const modelNames = [
        Announcement.modelName,
        BlogPost.modelName,
        ChatMessage.modelName,
        Choir.modelName,
        GalleryImage.modelName,
        Instrument.modelName,
        Log.modelName,
        Member.modelName,
        PlatformState.modelName,
        RefreshToken.modelName,
        Settings.modelName,
        Song.modelName,
        SongType.modelName,
        Theme.modelName,
        User.modelName
    ] as const;

    return modelNames.map((modelName, index) => ({
        modelName,
        droppedIndexes: results[index]
    }));
};
