// src/services/publicContent.service.ts

import Announcement from '../models/Announcement';
import BlogPost from '../models/BlogPost';
import Choir from '../models/Choir';
import GalleryImage from '../models/GalleryImage';
import Instrument from '../models/Instrument';
import Member from '../models/Member';
import Settings from '../models/Settings';
import Song from '../models/Song';
import SongType from '../models/SongType';
import Theme from '../models/Theme';
import { AppError } from '../errors/AppError';
import type { PublicChoirContext } from '../types/public.types';
import { parsePublicChoirCode } from '../validations/schemas/public.schemas';

export const resolvePublicChoir = async (
    choirCode: string
): Promise<PublicChoirContext> => {
    const normalizedCode = parsePublicChoirCode(choirCode);
    const choir = await Choir.findOne({
        code: normalizedCode,
        isActive: true
    })
        .select('_id name code description logoUrl')
        .lean();

    if (!choir) {
        throw new AppError(
            404,
            'PUBLIC_CHOIR_NOT_FOUND',
            'The requested choir does not exist or is inactive'
        );
    }

    return {
        id: choir._id,
        name: choir.name,
        code: choir.code,
        description: choir.description ?? '',
        logoUrl: choir.logoUrl ?? ''
    };
};

export const getPublicSettings = async (choir: PublicChoirContext) => {
    const settings = await Settings.findOne({ choirId: choir.id })
        .select(
            'webTitle contactPhone logoUrl socials homeLegends history createdAt updatedAt'
        )
        .lean();

    if (!settings) {
        throw new AppError(
            404,
            'PUBLIC_SETTINGS_NOT_FOUND',
            'Public settings were not found for the requested choir'
        );
    }

    return {
        choir: {
            name: choir.name,
            code: choir.code,
            description: choir.description,
            logoUrl: choir.logoUrl
        },
        settings
    };
};

export const listPublicAnnouncements = async (choir: PublicChoirContext) => {
    return Announcement.find({ choirId: choir.id, isPublic: true })
        .select('title content imageUrl createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean();
};

export const listPublicBlogPosts = async (choir: PublicChoirContext) => {
    return BlogPost.find({ choirId: choir.id, isPublic: true })
        .select('title content imageUrl author likes comments createdAt updatedAt')
        .populate('author', 'name username imageUrl')
        .sort({ createdAt: -1 })
        .lean();
};

export const listPublicGallery = async (choir: PublicChoirContext) => {
    return GalleryImage.find({ choirId: choir.id })
        .select(
            'title description imageUrl mediaType imageStart imageTopBar imageUs imageLogo imageGallery imageLeftMenu imageRightMenu createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .lean();
};

export const listPublicSongs = async (choir: PublicChoirContext) => {
    return Song.find({ choirId: choir.id })
        .select('title composer content audioUrl songTypeId createdAt updatedAt')
        .populate('songTypeId', 'name order parentId isParent')
        .sort({ title: 1 })
        .lean();
};

export const listPublicSongTypes = async (choir: PublicChoirContext) => {
    return SongType.find({ choirId: choir.id })
        .select('name order parentId isParent createdAt updatedAt')
        .sort({ order: 1, name: 1 })
        .lean();
};

export const listPublicThemes = async (choir: PublicChoirContext) => {
    return Theme.find({ choirId: choir.id })
        .select(
            'name isDark primaryColor accentColor backgroundColor textColor cardColor buttonColor navColor buttonTextColor secondaryTextColor borderColor createdAt updatedAt'
        )
        .sort({ name: 1 })
        .lean();
};

export const listPublicMembers = async (choir: PublicChoirContext) => {
    return Member.find({ choirId: choir.id })
        .select('name instrumentId instrumentLabel voice imageUrl createdAt updatedAt')
        .populate('instrumentId', 'name slug category iconKey iconUrl')
        .sort({ name: 1 })
        .lean();
};

export const listPublicInstruments = async (choir: PublicChoirContext) => {
    return Instrument.find({ choirId: choir.id, isActive: true })
        .select('name slug category iconKey iconUrl order createdAt updatedAt')
        .sort({ order: 1, name: 1 })
        .lean();
};
