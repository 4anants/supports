import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAdmin, AuthRequest } from '../middleware/auth';

import { verifyPin } from '../middleware/pin';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const offices = await prisma.office.findMany({ orderBy: { name: 'asc' } });
        res.json(offices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const { name } = req.body;
        const office = await prisma.office.create({ data: { name } });
        res.json(office);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        await prisma.office.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
