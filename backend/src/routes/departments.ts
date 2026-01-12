import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAdmin, AuthRequest } from '../middleware/auth';

import { verifyPin } from '../middleware/pin';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const departments = await prisma.department.findMany({ orderBy: { order: 'asc' } });
        res.json(departments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const { name, order } = req.body;
        const department = await prisma.department.create({ data: { name, order: order || null } });
        res.json(department);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        await prisma.department.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
