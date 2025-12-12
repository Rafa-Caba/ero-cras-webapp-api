import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

import { uploadMemberImage } from '../middlewares/cloudinaryStorage';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAuthors, applyPopulateSingleAuthor } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import Member from '../models/Member';
import Choir from '../models/Choir';

const router = express.Router();

const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error('Error parsing JSON from mobile:', e);
        }
    }
    return body;
};

const resolveChoirIdFromKey = async (choirKey?: string | null): Promise<string | null> => {
    if (!choirKey) return null;

    if (Types.ObjectId.isValid(choirKey)) {
        return choirKey;
    }

    const choir = await Choir.findOne({
        $or: [{ code: choirKey }, { name: choirKey }]
    }).select('_id');

    return choir ? (choir as any).id : null;
};

// PUBLIC ENDPOINT (optionally choir-scoped)
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const { choirId, choirKey } = req.query as {
            choirId?: string;
            choirKey?: string;
        };

        const filter: any = {};

        if (choirId) {
            filter.choirId = choirId;
        } else if (choirKey) {
            const resolved = await resolveChoirIdFromKey(choirKey);
            if (resolved) {
                filter.choirId = resolved;
            }
        }

        const members = await Member.find(filter)
            .select('name instrumentLabel instrumentId voice imageUrl')
            .sort({ name: 1 });

        res.json(members.map((m) => m.toJSON()));
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving public members',
            error: err.message
        });
    }
});

// SEARCH (Choir-scoped)
router.get(
    '/search',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        const query = req.query.q?.toString().trim();

        if (!query) {
            res.status(400).json({ message: 'Query is empty' });
            return;
        }

        try {
            const regex = new RegExp(query, 'i');
            const filters: any = {
                $or: [{ name: regex }, { instrumentLabel: regex }]
            };

            const authUser = req.user;
            const { choirId: queryChoirId, choirKey } = req.query as {
                choirId?: string;
                choirKey?: string;
            };

            if (authUser?.role !== 'SUPER_ADMIN') {
                if (authUser?.choirId) {
                    filters.choirId = authUser.choirId;
                }
            } else {
                if (queryChoirId) {
                    filters.choirId = queryChoirId;
                } else if (choirKey) {
                    const resolved = await resolveChoirIdFromKey(choirKey);
                    if (resolved) {
                        filters.choirId = resolved;
                    }
                }
            }

            const members = await applyPopulateAuthors(
                Member.find(filters)
                    .select('name instrumentLabel instrumentId voice imageUrl choirId')
                    .sort({ name: 1 })
            );

            res.json(members.map((m: any) => m.toJSON()));
        } catch (error) {
            res.status(500).json({ message: 'Search error' });
        }
    }
);

// LIST (Paginated, Choir-scoped)
router.get(
    '/',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            const filters: any = {};
            const authUser = req.user;
            const { choirId: queryChoirId, choirKey } = req.query as {
                choirId?: string;
                choirKey?: string;
            };

            if (authUser?.role !== 'SUPER_ADMIN') {
                if (authUser?.choirId) {
                    filters.choirId = authUser.choirId;
                }
            } else {
                if (queryChoirId) {
                    filters.choirId = queryChoirId;
                } else if (choirKey) {
                    const resolved = await resolveChoirIdFromKey(choirKey);
                    if (resolved) {
                        filters.choirId = resolved;
                    }
                }
            }

            const [members, total] = await Promise.all([
                applyPopulateAuthors(
                    Member.find(filters)
                        .sort({ name: 1 })
                        .skip(skip)
                        .limit(limit)
                        .select('name instrumentLabel instrumentId voice imageUrl choirId')
                ),
                Member.countDocuments(filters)
            ]);

            res.json({
                members: members.map((m: any) => m.toJSON()),
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalMembers: total
            });
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving members' });
        }
    }
);

// GET ONE (Choir-scoped)
router.get(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const authUser = req.user;
            const memberDoc = await Member.findById(req.params.id);

            if (!memberDoc) {
                res.status(404).json({ message: 'Member not found' });
                return;
            }

            if (authUser?.role !== 'SUPER_ADMIN' && authUser?.choirId) {
                if (
                    memberDoc.choirId &&
                    memberDoc.choirId.toString() !== authUser.choirId.toString()
                ) {
                    res.status(404).json({ message: 'Member not found' });
                    return;
                }
            }

            const member = await applyPopulateSingleAuthor(
                Member.findById(req.params.id).select(
                    'name instrumentLabel instrumentId voice imageUrl choirId'
                )
            );

            if (!member) {
                res.status(404).json({ message: 'Member not found' });
                return;
            }

            res.json(member.toJSON());
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

// CREATE (Choir-scoped, supports SUPER_ADMIN override via body.choirId)
router.post(
    '/',
    verifyToken,
    uploadMemberImage.single('file'),
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const { name, instrumentId, instrumentLabel, instrument, voice } = body;

            if (!name || (!instrumentId && !instrumentLabel && !instrument)) {
                res.status(400).json({
                    message: 'Name and Instrument are required'
                });
                return;
            }

            const authUser = req.user;
            let choirId: string | null = null;

            if (authUser?.role === 'SUPER_ADMIN' && body.choirId) {
                choirId = body.choirId;
            } else if (authUser?.choirId) {
                choirId = authUser.choirId;
            }

            if (!choirId) {
                res.status(400).json({
                    message: 'Choir not resolved for member creation'
                });
                return;
            }

            const newMember = new Member({
                name,
                instrumentId: instrumentId || null,
                instrumentLabel: instrumentLabel || instrument || '',
                voice: voice === 'true' || voice === true,
                imageUrl: req.file?.path || '',
                imagePublicId: req.file?.filename || '',
                choirId,
                createdBy: req.body.createdBy
            });

            await newMember.save();

            if (!newMember.id) {
                res.status(200).json({
                    message: 'Member created successfully',
                    member: newMember.toJSON()
                });
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'Members',
                action: 'create',
                referenceId: newMember.id.toString(),
                changes: { new: newMember.toJSON() }
            });

            res.status(200).json({
                message: 'Member created successfully',
                member: newMember.toJSON()
            });
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
);

// UPDATE (Choir-scoped)
router.put(
    '/:id',
    verifyToken,
    uploadMemberImage.single('file'),
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const body = parseBody(req);
            const {
                name,
                instrumentId,
                instrumentLabel,
                instrument,
                voice,
                choirId: bodyChoirId
            } = body;

            const member = await Member.findById(req.params.id);

            if (!member) {
                res.status(404).json({ message: 'Member not found' });
                return;
            }

            const authUser = req.user;
            if (authUser?.role !== 'SUPER_ADMIN' && authUser?.choirId) {
                if (
                    member.choirId &&
                    member.choirId.toString() !== authUser.choirId.toString()
                ) {
                    res.status(404).json({ message: 'Member not found' });
                    return;
                }
            }

            // Handle Image Replacement
            if (req.file) {
                if (member.imagePublicId) {
                    await cloudinary.uploader.destroy(member.imagePublicId);
                }
                member.imageUrl = req.file.path;
                member.imagePublicId = req.file.filename;
            }

            // Update fields safely
            if (name) member.name = name;

            if (instrumentId !== undefined) {
                member.instrumentId = instrumentId || null;
            }
            if (instrumentLabel) {
                member.instrumentLabel = instrumentLabel;
            } else if (instrument) {
                member.instrumentLabel = instrument;
            }

            if (voice !== undefined) {
                member.voice = voice === 'true' || voice === true;
            }

            if (authUser?.role === 'SUPER_ADMIN' && bodyChoirId) {
                member.choirId = bodyChoirId;
            }

            member.updatedBy = (req.body as any).updatedBy;

            const updatedMember = await member.save();

            await registerLog({
                req: req as any,
                collection: 'Members',
                action: 'update',
                referenceId: updatedMember.id.toString(),
                changes: { updated: updatedMember.toJSON() }
            });

            res.json(updatedMember.toJSON());
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
);

// DELETE (Choir-scoped)
router.delete(
    '/:id',
    verifyToken,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const member = await Member.findById(req.params.id);

            if (!member) {
                res.status(404).json({ message: 'Member not found' });
                return;
            }

            const authUser = req.user;
            if (authUser?.role !== 'SUPER_ADMIN' && authUser?.choirId) {
                if (
                    member.choirId &&
                    member.choirId.toString() !== authUser.choirId.toString()
                ) {
                    res.status(404).json({ message: 'Member not found' });
                    return;
                }
            }

            if (member.imagePublicId) {
                await cloudinary.uploader.destroy(member.imagePublicId);
            }

            await Member.findByIdAndDelete(req.params.id);

            await registerLog({
                req: req as any,
                collection: 'Members',
                action: 'delete',
                referenceId: member.id.toString(),
                changes: { deleted: member.toJSON() }
            });

            res.json({ message: 'Member deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
);

export default router;
