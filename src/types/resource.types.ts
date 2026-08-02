// src/types/resource.types.ts

import type { GalleryMediaType } from '../models/GalleryImage';
import type { MessageType } from '../models/ChatMessage';
import type {
    SettingsHomeLegends,
    SettingsSocials
} from '../models/Settings';

export type ContentValue = string | object;

export interface AnnouncementInput {
    readonly title: string;
    readonly content: ContentValue;
    readonly isPublic: boolean;
}

export interface BlogInput {
    readonly title: string;
    readonly content: ContentValue;
    readonly isPublic: boolean;
}

export interface GalleryInput {
    readonly title: string;
    readonly description: string;
    readonly mediaType: GalleryMediaType;
    readonly imageStart: boolean;
    readonly imageTopBar: boolean;
    readonly imageUs: boolean;
    readonly imageLogo: boolean;
    readonly imageGallery: boolean;
    readonly imageLeftMenu: boolean;
    readonly imageRightMenu: boolean;
}

export interface InstrumentInput {
    readonly name: string;
    readonly slug: string;
    readonly category: string;
    readonly iconKey: string;
    readonly isActive: boolean;
    readonly order: number;
}

export interface MemberInput {
    readonly name: string;
    readonly instrumentId?: string | null;
    readonly instrumentLabel: string;
    readonly voice: boolean;
}

export interface SettingsInput {
    readonly webTitle?: string;
    readonly contactPhone?: string;
    readonly socials?: SettingsSocials;
    readonly homeLegends?: SettingsHomeLegends;
    readonly history?: ContentValue;
}

export interface SongInput {
    readonly title: string;
    readonly composer: string;
    readonly content: ContentValue;
    readonly songTypeId?: string | null;
}

export interface SongTypeInput {
    readonly name: string;
    readonly order: number;
    readonly parentId?: string | null;
    readonly isParent: boolean;
}

export interface ThemeInput {
    readonly name: string;
    readonly isDark: boolean;
    readonly primaryColor: string;
    readonly accentColor: string;
    readonly backgroundColor: string;
    readonly textColor: string;
    readonly cardColor: string;
    readonly buttonColor: string;
    readonly navColor: string;
    readonly buttonTextColor: string;
    readonly secondaryTextColor: string;
    readonly borderColor: string;
}

export interface ChatMessageInput {
    readonly content: ContentValue;
    readonly type: MessageType;
    readonly fileUrl: string;
    readonly filename: string;
    readonly imageUrl: string;
    readonly audioUrl: string;
    readonly imagePublicId: string;
    readonly replyTo?: string | null;
}
