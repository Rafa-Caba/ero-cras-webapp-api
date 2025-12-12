import express, { Request, Response } from 'express';
import { Types } from 'mongoose';

import Theme from '../models/Theme';
import Choir from '../models/Choir';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAuthors, applyPopulateSingleAuthor } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';

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
        $or: [{ code: choirKey }, { name: choirKey }],
    }).select('_id');

    return choir ? (choir as any).id : null;
};

// PUBLIC ENDPOINT
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

        const themes = await Theme.find(filter).sort({ name: 1 });

        res.json({ themes: themes.map(t => t.toJSON()) });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving public themes',
            error: err.message,
        });
    }
});

// ADMIN LIST
router.get('/', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const user = req.user;
        const { all, page, limit, choirId, choirKey } = req.query as {
            all?: string;
            page?: string;
            limit?: string;
            choirId?: string;
            choirKey?: string;
        };

        const filter: any = {};

        if (user?.role !== 'SUPER_ADMIN') {
            if (user?.choirId) {
                filter.choirId = user.choirId;
            }
        } else {
            if (choirId) {
                filter.choirId = choirId;
            } else if (choirKey) {
                const resolved = await resolveChoirIdFromKey(choirKey);
                if (resolved) {
                    filter.choirId = resolved;
                }
            } else if (user?.choirId) {
                filter.choirId = user.choirId;
            }
        }

        if (all === 'true') {
            const themesQuery = Theme.find(filter).sort({ name: 1 });
            const themes = await applyPopulateAuthors(themesQuery);
            res.json({
                themes: themes.map((t: any) => (typeof t.toJSON === 'function' ? t.toJSON() : t)),
                totalThemes: themes.length,
            });
            return;
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;
        const skip = (pageNum - 1) * limitNum;

        const [themesRaw, total] = await Promise.all([
            applyPopulateAuthors(
                Theme.find(filter)
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limitNum)
            ),
            Theme.countDocuments(filter),
        ]);

        const themes = themesRaw.map((t: any) =>
            typeof t.toJSON === 'function' ? t.toJSON() : t
        );

        res.json({
            themes,
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalThemes: total,
        });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving themes',
            error: err.message,
        });
    }
});

// GET ONE 
router.get('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        const themeDoc = await applyPopulateSingleAuthor(Theme.findById(id));

        if (!themeDoc) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        const theme: any =
            typeof (themeDoc as any).toJSON === 'function'
                ? (themeDoc as any).toJSON()
                : themeDoc;

        if (
            user?.role !== 'SUPER_ADMIN' &&
            user?.choirId &&
            theme.choirId &&
            theme.choirId.toString() !== user.choirId.toString()
        ) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        res.json(theme);
    } catch (err: any) {
        res.status(500).json({
            message: 'Error retrieving theme',
            error: err.message,
        });
    }
});

// CREATE 
router.post(
    '/',
    verifyToken,
    setCreatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const user = req.user;
            const body = parseBody(req);

            const {
                name,
                isDark,
                primaryColor,
                accentColor,
                backgroundColor,
                textColor,
                cardColor,
                buttonColor,
                navColor,
                buttonTextColor,
                secondaryTextColor,
                borderColor,
                choirId,
                choirKey,
            } = body;

            if (!name || !primaryColor || !backgroundColor || !textColor || !accentColor || !cardColor || !buttonColor || !navColor) {
                res.status(400).json({ message: 'Missing required theme fields' });
                return;
            }

            let targetChoirId: string | null = null;

            if (user?.role === 'SUPER_ADMIN') {
                if (choirId) {
                    targetChoirId = choirId;
                } else if (choirKey) {
                    targetChoirId = await resolveChoirIdFromKey(choirKey);
                } else if (user.choirId) {
                    targetChoirId = user.choirId;
                }
            } else if (user?.choirId) {
                targetChoirId = user.choirId;
            }

            const existing = await Theme.findOne({
                name,
                choirId: targetChoirId || null,
            });

            if (existing) {
                res.status(409).json({ message: 'Theme name already exists for this choir' });
                return;
            }

            const newTheme = new Theme({
                name,
                isDark: isDark === true || String(isDark) === 'true',
                primaryColor,
                accentColor,
                backgroundColor,
                textColor,
                cardColor,
                buttonColor,
                navColor,
                buttonTextColor,
                secondaryTextColor,
                borderColor,
                choirId: targetChoirId || null,
                createdBy: req.body.createdBy,
            });

            await newTheme.save();

            if (!newTheme.id) {
                res.status(201).json({ message: 'Theme created successfully', theme: newTheme });
                return;
            }

            await registerLog({
                req: req as any,
                collection: 'Themes',
                action: 'create',
                referenceId: newTheme.id.toString(),
                changes: { new: newTheme.toJSON() },
            });

            res.status(201).json({
                message: 'Theme created successfully',
                theme: newTheme.toJSON(),
            });
        } catch (err: any) {
            res.status(500).json({
                message: 'Error creating theme',
                error: err.message,
            });
        }
    }
);

// UPDATE 
router.put(
    '/:id',
    verifyToken,
    setUpdatedBy,
    async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const user = req.user;
            const body = parseBody(req);

            const theme = await Theme.findById(id);

            if (!theme) {
                res.status(404).json({ message: 'Theme not found' });
                return;
            }

            if (
                user?.role !== 'SUPER_ADMIN' &&
                user?.choirId &&
                theme.choirId &&
                theme.choirId.toString() !== user.choirId.toString()
            ) {
                res.status(404).json({ message: 'Theme not found' });
                return;
            }

            if (user?.role === 'SUPER_ADMIN') {
                if (body.choirId) {
                    theme.choirId = body.choirId;
                } else if (body.choirKey) {
                    const resolved = await resolveChoirIdFromKey(body.choirKey);
                    if (resolved) {
                        theme.choirId = resolved as any;
                    }
                }
            }

            const {
                name,
                isDark,
                primaryColor,
                accentColor,
                backgroundColor,
                textColor,
                cardColor,
                buttonColor,
                navColor,
                buttonTextColor,
                secondaryTextColor,
                borderColor,
            } = body;

            if (name && name !== theme.name) {
                const existing = await Theme.findOne({
                    name,
                    choirId: theme.choirId || null,
                });

                if (existing && existing.id.toString() !== id) {
                    res.status(409).json({
                        message: 'Theme name already exists for this choir',
                    });
                    return;
                }

                theme.name = name;
            }

            if (isDark !== undefined) {
                theme.isDark = isDark === true || String(isDark) === 'true';
            }

            if (primaryColor) theme.primaryColor = primaryColor;
            if (accentColor) theme.accentColor = accentColor;
            if (backgroundColor) theme.backgroundColor = backgroundColor;
            if (textColor) theme.textColor = textColor;
            if (cardColor) theme.cardColor = cardColor;
            if (buttonColor) theme.buttonColor = buttonColor;
            if (navColor) theme.navColor = navColor;

            if (buttonTextColor) theme.buttonTextColor = buttonTextColor;
            if (secondaryTextColor) theme.secondaryTextColor = secondaryTextColor;
            if (borderColor) theme.borderColor = borderColor;

            theme.updatedBy = req.body.updatedBy;

            const updatedTheme = await theme.save();

            await registerLog({
                req: req as any,
                collection: 'Themes',
                action: 'update',
                referenceId: updatedTheme.id.toString(),
                changes: { after: updatedTheme.toJSON() },
            });

            res.json({
                message: 'Theme updated successfully',
                theme: updatedTheme.toJSON(),
            });
        } catch (err: any) {
            res.status(500).json({
                message: 'Error updating theme',
                error: err.message,
            });
        }
    }
);

// DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = req.user;

        const theme = await Theme.findById(id);

        if (!theme) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        if (
            user?.role !== 'SUPER_ADMIN' &&
            user?.choirId &&
            theme.choirId &&
            theme.choirId.toString() !== user.choirId.toString()
        ) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        await Theme.findByIdAndDelete(id);

        await registerLog({
            req: req as any,
            collection: 'Themes',
            action: 'delete',
            referenceId: theme.id.toString(),
            changes: { deleted: theme.toJSON() },
        });

        res.json({ message: 'Theme deleted successfully' });
    } catch (err: any) {
        res.status(500).json({
            message: 'Error deleting theme',
            error: err.message,
        });
    }
});

export default router;
