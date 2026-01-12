import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../lib/auth';

import { verifyPin } from '../middleware/pin';

const router = Router();

// GET /api/users - List all users (admin only)
router.get('/', requireAdmin, async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                role: true,
                avatar: true,
                created: true
            },
            orderBy: { created: 'desc' }
        });
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users - Create user (admin only)
router.post('/', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const { email, password, name, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const hashedPassword = await hashPassword(password);
        const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || '',
                username,
                role: role || 'IT Support'
            },
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                role: true,
                created: true
            }
        });

        res.json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/users/:id - Update user (admin only)
router.patch('/:id', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { email, name, role, password } = req.body;

        const updateData: any = {};
        if (email) updateData.email = email;
        if (name !== undefined) updateData.name = name;
        if (role) updateData.role = role;
        if (password) updateData.password = await hashPassword(password);

        const user = await prisma.user.update({
            where: { id: String(id) },
            data: updateData,
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                role: true,
                avatar: true
            }
        });

        res.json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireAdmin, verifyPin, async (req: AuthRequest, res) => {
    try {
        await prisma.user.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
