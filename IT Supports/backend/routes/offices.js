"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const pin_1 = require("../middleware/pin");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const offices = await prisma_1.default.office.findMany({ orderBy: { name: 'asc' } });
        res.json(offices);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        const { name } = req.body;
        const office = await prisma_1.default.office.create({ data: { name } });
        res.json(office);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.delete('/:id', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.office.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=offices.js.map