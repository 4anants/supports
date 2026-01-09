import { Router } from 'express';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword, generateToken } from '../lib/auth';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

//POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, username } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const hashedPassword = await hashPassword(password);
        const generatedUsername = username || email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || '',
                username: generatedUsername,
                role: 'IT Support'
            }
        });

        const token = generateToken({ userId: user.id, email: user.email, role: user.role });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findFirst({
            where: { OR: [{ email }, { username: email }] }
        });

        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken({ userId: user.id, email: user.email, role: user.role });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                username: user.username,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: {
                id: true,
                email: true,
                username: true,
                name: true,
                role: true,
                avatar: true,
                created: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
