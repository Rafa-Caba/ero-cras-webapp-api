import express, { Request, Response } from 'express';
import Theme from '../models/Theme';
import verifyToken, { RequestWithUser } from '../middlewares/auth';
import { setUpdatedBy, setCreatedBy } from '../utils/setCreatedBy';
import { applyPopulateAutores, applyPopulateAutorSingle } from '../utils/populateHelpers';
import { registerLog } from '../utils/logger';

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

// 🟣 PUBLIC ENDPOINT (Get all active/public themes)
router.get('/public', async (req: Request, res: Response): Promise<void> => {
    try {
        const themes = await Theme.find().sort({ name: 1 });
        res.json({ themes });
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving public themes', error: err.message });
    }
});

// 🟣 ADMIN LIST (Paginated or All)
router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { all, page, limit } = req.query;

        if (all === 'true') {
            const themes = await Theme.find();
            res.json({ themes, totalThemes: themes.length });
        } else {
            const pageNum = parseInt(page as string) || 1;
            const limitNum = parseInt(limit as string) || 10;
            const skip = (pageNum - 1) * limitNum;

            const [themes, total] = await Promise.all([
                // Using populate helper to get creator info
                applyPopulateAutores(Theme.find().sort({ name: 1 }).skip(skip).limit(limitNum)),
                Theme.countDocuments()
            ]);

            res.json({
                themes,
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                totalThemes: total
            });
        }
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving themes', error: err.message });
    }
});

// 🟣 GET ONE
router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const theme = await applyPopulateAutorSingle(Theme.findById(id));

        if (!theme) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }
        res.json(theme);
    } catch (err: any) {
        res.status(500).json({ message: 'Error retrieving theme', error: err.message });
    }
});

// 🟣 CREATE
router.post('/', 
    verifyToken, 
    setCreatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const body = parseBody(req);
        
        // Destructure all expected fields based on English Model
        const { 
            name, isDark, 
            primaryColor, accentColor, backgroundColor, textColor, 
            cardColor, buttonColor, navColor,
            buttonTextColor, secondaryTextColor, borderColor 
        } = body;

        // Validation
        if (!name || !primaryColor || !backgroundColor || !textColor) {
            res.status(400).json({ message: 'Missing required theme fields' });
            return;
        }

        const existing = await Theme.findOne({ name });
        if (existing) {
            res.status(409).json({ message: 'Theme name already exists' });
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
            // Optionals with defaults handling in model, but good to pass if present
            buttonTextColor,
            secondaryTextColor,
            borderColor,
            createdBy: req.body.createdBy
        });

        await newTheme.save();

        if (!newTheme._id) return;

        await registerLog({
            req: req as any,
            collection: 'Themes',
            action: 'create',
            referenceId: newTheme._id.toString(),
            changes: { new: newTheme }
        });

        res.status(201).json({ message: 'Theme created successfully', theme: newTheme });
    } catch (err: any) {
        res.status(500).json({ message: 'Error creating theme', error: err.message });
    }
});

// 🟣 UPDATE
router.put('/:id', 
    verifyToken, 
    setUpdatedBy, 
    async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const body = parseBody(req);
        
        const { 
            name, isDark, 
            primaryColor, accentColor, backgroundColor, textColor, 
            cardColor, buttonColor, navColor,
            buttonTextColor, secondaryTextColor, borderColor 
        } = body;

        // Build update object dynamically
        const updateFields: any = {};
        if (name) updateFields.name = name;
        if (isDark !== undefined) updateFields.isDark = isDark === true || String(isDark) === 'true';
        
        if (primaryColor) updateFields.primaryColor = primaryColor;
        if (accentColor) updateFields.accentColor = accentColor;
        if (backgroundColor) updateFields.backgroundColor = backgroundColor;
        if (textColor) updateFields.textColor = textColor;
        if (cardColor) updateFields.cardColor = cardColor;
        if (buttonColor) updateFields.buttonColor = buttonColor;
        if (navColor) updateFields.navColor = navColor;
        
        if (buttonTextColor) updateFields.buttonTextColor = buttonTextColor;
        if (secondaryTextColor) updateFields.secondaryTextColor = secondaryTextColor;
        if (borderColor) updateFields.borderColor = borderColor;

        // Add updatedBy from middleware
        updateFields.updatedBy = req.body.updatedBy;

        const updatedTheme = await Theme.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true }
        );

        if (!updatedTheme) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        await registerLog({
            req: req as any,
            collection: 'Themes',
            action: 'update',
            referenceId: updatedTheme.id.toString(),
            changes: { after: updatedTheme }
        });

        res.json({ message: 'Theme updated successfully', theme: updatedTheme });
    } catch (err: any) {
        res.status(500).json({ message: 'Error updating theme', error: err.message });
    }
});

// 🟣 DELETE
router.delete('/:id', verifyToken, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const theme = await Theme.findById(id);

        if (!theme) {
            res.status(404).json({ message: 'Theme not found' });
            return;
        }

        await Theme.findByIdAndDelete(id);

        await registerLog({
            req: req as any,
            collection: 'Themes',
            action: 'delete',
            referenceId: theme.id.toString(),
            changes: { deleted: theme }
        });

        res.json({ message: 'Theme deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ message: 'Error deleting theme', error: err.message });
    }
});

export default router;