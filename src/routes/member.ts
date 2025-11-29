import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { uploadMemberImage } from '../middlewares/cloudinaryStorage';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';
import Member from '../models/Member';

const router = express.Router();

/**
 * Helper: Parse Request Body
 */
const parseBody = (req: Request) => {
    let body = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
        try {
            body = JSON.parse(req.body.data);
        } catch (e) {
            console.error("Error parsing JSON from mobile:", e);
        }
    }
    return body;
};

// 🟣 PUBLIC ENDPOINT
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        // Select specific fields for public view
        const members = await Member.find()
            .select('name instrument voice imageUrl');

        res.json(members);
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving public members', error: err.message });
    }
});

// 🟣 SEARCH
router.get('/search', verifyToken, async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q?.toString().trim();

    if (!query) {
        res.status(400).json({ message: 'Query is empty' });
        return;
    }

    try {
        const regex = new RegExp(query, 'i');
        const members = await applyPopulateAutores(Member.find({
            $or: [
                { name: regex },
                { instrument: regex }
            ]
        }).select('name instrument voice imageUrl'));

        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Search error' });
    }
});

// 🟣 LIST (Paginated)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10; // Default limit 10
        const skip = (page - 1) * limit;

        const [members, total] = await Promise.all([
            applyPopulateAutores(Member.find()
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .select('name instrument voice imageUrl')),
            Member.countDocuments()
        ]);

        res.json({
            members,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMembers: total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving members' });
    }
});

// 🟣 GET ONE
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const member = await applyPopulateAutorSingle(Member.findById(req.params.id)
            .select('name instrument voice imageUrl'));

        if (!member) {
            res.status(404).json({ message: 'Member not found' });
            return;
        }

        res.json(member);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// 🟣 CREATE
router.post('/', 
    verifyToken, 
    uploadMemberImage.single('file'), // Standard field 'file'
    setCreatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        const { name, instrument, voice } = body;

        if (!name || !instrument) {
            res.status(400).json({ message: 'Name and Instrument are required' });
            return;
        }

        const newMember = new Member({
            name,
            instrument,
            // Handle boolean string
            voice: voice === 'true' || voice === true,
            imageUrl: req.file?.path || '',
            imagePublicId: req.file?.filename || '',
            createdBy: req.body.createdBy
        });

        await newMember.save();

        if (!newMember._id) return;

        await registerLog({
            req: req as any,
            collection: 'Members',
            action: 'create',
            referenceId: newMember._id.toString(),
            changes: { new: newMember }
        });

        res.status(200).json({
            message: 'Member created successfully',
            member: newMember
        });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

// 🟣 UPDATE
router.put('/:id', 
    verifyToken, 
    uploadMemberImage.single('file'), 
    setUpdatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        const { name, instrument, voice } = body;
        
        const member = await Member.findById(req.params.id);

        if (!member) {
            res.status(404).json({ message: 'Member not found' });
            return;
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
        if (instrument) member.instrument = instrument;
        if (voice !== undefined) {
            member.voice = voice === 'true' || voice === true;
        }
        
        member.updatedBy = req.body.updatedBy;

        const updatedMember = await member.save();

        await registerLog({
            req: req as any,
            collection: 'Members',
            action: 'update',
            referenceId: updatedMember.id.toString(),
            changes: { updated: updatedMember }
        });

        res.json(updatedMember);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

// 🟣 DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const member = await Member.findById(req.params.id);

        if (!member) {
            res.status(404).json({ message: 'Member not found' });
            return;
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
            changes: { deleted: member }
        });

        res.json({ message: 'Member deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;