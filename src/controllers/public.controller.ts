// src/controllers/public.controller.ts

import type { Request, Response } from 'express';
import {
    getPublicSettings,
    listPublicAnnouncements,
    listPublicBlogPosts,
    listPublicGallery,
    listPublicInstruments,
    listPublicMembers,
    listPublicSongs,
    listPublicSongTypes,
    listPublicThemes,
    resolvePublicChoir
} from '../services/publicContent.service';
import type { PublicChoirParams } from '../validations/schemas/public.schemas';

const resolveChoirFromRequest = (req: Request<PublicChoirParams>) => {
    return resolvePublicChoir(req.params.choirCode);
};

export const getPublicSettingsController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await getPublicSettings(await resolveChoirFromRequest(req)));
};

export const listPublicAnnouncementsController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicAnnouncements(await resolveChoirFromRequest(req)));
};

export const listPublicBlogController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicBlogPosts(await resolveChoirFromRequest(req)));
};

export const listPublicGalleryController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicGallery(await resolveChoirFromRequest(req)));
};

export const listPublicSongsController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicSongs(await resolveChoirFromRequest(req)));
};

export const listPublicSongTypesController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicSongTypes(await resolveChoirFromRequest(req)));
};

export const listPublicThemesController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicThemes(await resolveChoirFromRequest(req)));
};

export const listPublicMembersController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicMembers(await resolveChoirFromRequest(req)));
};

export const listPublicInstrumentsController = async (
    req: Request<PublicChoirParams>,
    res: Response
): Promise<void> => {
    res.json(await listPublicInstruments(await resolveChoirFromRequest(req)));
};
