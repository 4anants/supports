"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const auth_2 = require("../lib/auth");
const pin_1 = require("../middleware/pin");
const router = (0, express_1.Router)();
// GET /api/users - List all users (admin only)
router.get('/', auth_1.requireAdmin, async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/users - Create user (admin only)
router.post('/', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        const { email, password, name, role, avatar } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        // Basic Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        // Password Strength Check
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        const hashedPassword = await (0, auth_2.hashPassword)(password);
        const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || '',
                username,
                role: role || 'IT Support',
                avatar: avatar || null
            },
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
        res.json(user);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// PATCH /api/users/:id - Update user (admin only)
router.patch('/:id', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, role, password, avatar } = req.body;
        const updateData = {};
        if (email)
            updateData.email = email;
        if (name !== undefined)
            updateData.name = name;
        if (role)
            updateData.role = role;
        if (avatar !== undefined)
            updateData.avatar = avatar;
        if (password)
            updateData.password = await (0, auth_2.hashPassword)(password);
        const user = await prisma_1.default.user.update({
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
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.user.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map