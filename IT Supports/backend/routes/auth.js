"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
//POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, username } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const generatedUsername = username || email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || '',
                username: generatedUsername,
                role: 'IT Support'
            }
        });
        const token = (0, auth_1.generateToken)({ userId: user.id, email: user.email, role: user.role });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.default.user.findFirst({
            where: { OR: [{ email }, { username: email }] }
        });
        if (!user || !(await (0, auth_1.comparePassword)(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = (0, auth_1.generateToken)({ userId: user.id, email: user.email, role: user.role });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/auth/me
router.get('/me', auth_2.requireAuth, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map