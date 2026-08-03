// src/validations/schemas/resource.schemas.ts

import type { Request } from 'express';
import { AppError } from '../../errors/AppError';
import type { GalleryMediaType } from '../../models/GalleryImage';
import type { MessageType } from '../../models/ChatMessage';
import type {
    SettingsHomeLegends,
    SettingsSocials
} from '../../models/Settings';
import type {
    AnnouncementInput,
    BlogInput,
    ChatMessageInput,
    GalleryInput,
    InstrumentInput,
    MemberInput,
    SettingsInput,
    SongInput,
    SongTypeInput,
    ThemeInput
} from '../../types/resource.types';
import {
    parseRequestBody,
    readOptionalBoolean,
    readOptionalNumber,
    readOptionalObject,
    readOptionalObjectId,
    readOptionalString,
    readRequiredContent,
    readRequiredString
} from './common.schemas';

const readGalleryMediaType = (value: string | undefined): GalleryMediaType => {
    const normalizedValue = value?.toUpperCase() ?? 'IMAGE';

    if (normalizedValue !== 'IMAGE' && normalizedValue !== 'VIDEO') {
        throw new AppError(
            400,
            'INVALID_MEDIA_TYPE',
            'mediaType must be IMAGE or VIDEO'
        );
    }

    return normalizedValue;
};

const readMessageType = (value: string | undefined): MessageType => {
    const normalizedValue = value?.toUpperCase() ?? 'TEXT';
    const allowedTypes: readonly MessageType[] = [
        'TEXT',
        'IMAGE',
        'FILE',
        'MEDIA',
        'REACTION',
        'AUDIO',
        'VIDEO'
    ];
    const messageType = allowedTypes.find(
        (allowedType) => allowedType === normalizedValue
    );

    if (!messageType) {
        throw new AppError(
            400,
            'INVALID_MESSAGE_TYPE',
            'Unsupported chat message type'
        );
    }

    return messageType;
};

const readRecord = (
    value: object
): Record<string, string | number | boolean | object | null | undefined> => {
    return value as Record<
        string,
        string | number | boolean | object | null | undefined
    >;
};

const readSocials = (value: object | undefined): SettingsSocials | undefined => {
    if (!value) return undefined;
    const record = readRecord(value);

    return {
        facebook: typeof record.facebook === 'string' ? record.facebook : '',
        instagram: typeof record.instagram === 'string' ? record.instagram : '',
        youtube: typeof record.youtube === 'string' ? record.youtube : '',
        whatsapp: typeof record.whatsapp === 'string' ? record.whatsapp : '',
        email: typeof record.email === 'string' ? record.email : ''
    };
};

const readHomeLegends = (
    value: object | undefined
): SettingsHomeLegends | undefined => {
    if (!value) return undefined;
    const record = readRecord(value);

    return {
        principal: typeof record.principal === 'string' ? record.principal : '',
        secondary: typeof record.secondary === 'string' ? record.secondary : ''
    };
};

export const parseAnnouncementInput = (req: Request): AnnouncementInput => {
    const body = parseRequestBody(req);

    return {
        title: readRequiredString(body, 'title'),
        content: readRequiredContent(body, 'content'),
        isPublic: readOptionalBoolean(body, 'isPublic') ?? false
    };
};

export const parseBlogInput = (req: Request): BlogInput => {
    const body = parseRequestBody(req);

    return {
        title: readRequiredString(body, 'title'),
        content: readRequiredContent(body, 'content'),
        isPublic: readOptionalBoolean(body, 'isPublic') ?? false
    };
};

export const parseGalleryInput = (req: Request): GalleryInput => {
    const body = parseRequestBody(req);

    return {
        title: readRequiredString(body, 'title'),
        description: readOptionalString(body, 'description') ?? '',
        mediaType: readGalleryMediaType(readOptionalString(body, 'mediaType')),
        imageStart: readOptionalBoolean(body, 'imageStart') ?? false,
        imageTopBar: readOptionalBoolean(body, 'imageTopBar') ?? false,
        imageUs: readOptionalBoolean(body, 'imageUs') ?? false,
        imageLogo: readOptionalBoolean(body, 'imageLogo') ?? false,
        imageGallery: readOptionalBoolean(body, 'imageGallery') ?? false,
        imageLeftMenu: readOptionalBoolean(body, 'imageLeftMenu') ?? false,
        imageRightMenu: readOptionalBoolean(body, 'imageRightMenu') ?? false
    };
};

export const parseInstrumentInput = (req: Request): InstrumentInput => {
    const body = parseRequestBody(req);
    const name = readRequiredString(body, 'name');

    return {
        name,
        slug:
            readOptionalString(body, 'slug') ??
            name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: readOptionalString(body, 'category') ?? '',
        iconKey: readOptionalString(body, 'iconKey') ?? '',
        isActive: readOptionalBoolean(body, 'isActive') ?? true,
        order: readOptionalNumber(body, 'order') ?? 0
    };
};

export const parseMemberInput = (req: Request): MemberInput => {
    const body = parseRequestBody(req);
    const instrumentId = readOptionalObjectId(body, 'instrumentId');

    return {
        name: readRequiredString(body, 'name'),
        instrumentId: instrumentId === undefined
            ? undefined
            : instrumentId?.toString() ?? null,
        instrumentLabel:
            readOptionalString(body, 'instrumentLabel') ??
            readOptionalString(body, 'instrument') ??
            '',
        voice: readOptionalBoolean(body, 'voice') ?? false
    };
};

export const parseSettingsInput = (req: Request): SettingsInput => {
    const body = parseRequestBody(req);

    return {
        webTitle: readOptionalString(body, 'webTitle'),
        contactPhone: readOptionalString(body, 'contactPhone'),
        socials: readSocials(readOptionalObject(body, 'socials')),
        homeLegends: readHomeLegends(readOptionalObject(body, 'homeLegends')),
        history: body.history === undefined
            ? undefined
            : readRequiredContent(body, 'history')
    };
};

export const parseSongInput = (req: Request): SongInput => {
    const body = parseRequestBody(req);
    const songTypeId = readOptionalObjectId(body, 'songTypeId');

    return {
        title: readRequiredString(body, 'title'),
        composer: readOptionalString(body, 'composer') ?? '',
        content: readRequiredContent(body, 'content'),
        songTypeId: songTypeId === undefined
            ? undefined
            : songTypeId?.toString() ?? null
    };
};

export const parseSongTypeInput = (req: Request): SongTypeInput => {
    const body = parseRequestBody(req);
    const parentId = readOptionalObjectId(body, 'parentId');
    const name = readOptionalString(body, 'name') ??
        readRequiredString(body, 'nombre');

    return {
        name,
        order: readOptionalNumber(body, 'order') ?? 0,
        parentId: parentId === undefined
            ? undefined
            : parentId?.toString() ?? null,
        isParent: readOptionalBoolean(body, 'isParent') ?? false
    };
};

export const parseThemeInput = (req: Request): ThemeInput => {
    const body = parseRequestBody(req);

    return {
        name: readRequiredString(body, 'name'),
        isDark: readOptionalBoolean(body, 'isDark') ?? false,
        primaryColor: readRequiredString(body, 'primaryColor'),
        accentColor: readRequiredString(body, 'accentColor'),
        backgroundColor: readRequiredString(body, 'backgroundColor'),
        textColor: readRequiredString(body, 'textColor'),
        cardColor: readRequiredString(body, 'cardColor'),
        buttonColor: readRequiredString(body, 'buttonColor'),
        navColor: readRequiredString(body, 'navColor'),
        buttonTextColor:
            readOptionalString(body, 'buttonTextColor') ?? '#ffffff',
        secondaryTextColor:
            readOptionalString(body, 'secondaryTextColor') ?? '#6c757d',
        borderColor: readOptionalString(body, 'borderColor') ?? '#dee2e6'
    };
};

export const parseChatMessageInput = (req: Request): ChatMessageInput => {
    const body = parseRequestBody(req);
    const replyTo = readOptionalObjectId(body, 'replyTo') ??
        readOptionalObjectId(body, 'replyToId');

    const mediaAssetId = readOptionalObjectId(body, 'mediaAssetId');

    return {
        content: readRequiredContent(body, 'content'),
        type: readMessageType(readOptionalString(body, 'type')),
        filename: readOptionalString(body, 'filename') ?? '',
        mediaAssetId: mediaAssetId === undefined
            ? undefined
            : mediaAssetId?.toString() ?? null,
        replyTo: replyTo === undefined
            ? undefined
            : replyTo?.toString() ?? null
    };
};
