"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const email_1 = __importDefault(require("../lib/email"));
const auth_1 = require("../middleware/auth");
const pin_1 = require("../middleware/pin");
const router = (0, express_1.Router)();
// GET /api/inventory - List inventory items
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/inventory called from', req.ip);
        const items = await prisma_1.default.inventory.findMany({
            orderBy: { item_name: 'asc' }
        });
        console.log(`Returned ${items.length} items`);
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/inventory/logs - List inventory logs
router.get('/logs', auth_1.requireAuth, async (req, res) => {
    try {
        const logs = await prisma_1.default.inventoryLog.findMany({
            orderBy: { timestamp: 'desc' }
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/inventory/bulk - Bulk create or update (increment) inventory items
router.post('/bulk', auth_1.requireAdmin, async (req, res) => {
    try {
        const { items } = req.body; // Array of items
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Items must be an array' });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user?.userId } });
        const performedByName = user?.name || user?.email || 'Admin';
        const results = [];
        for (const itemData of items) {
            const { item_name, category, office_location, quantity, min_threshold } = itemData;
            if (!item_name || !office_location)
                continue; // Skip invalid
            const existing = await prisma_1.default.inventory.findFirst({
                where: {
                    item_name,
                    office_location
                }
            });
            if (existing) {
                // Upsert Logic: Increment quantity
                const qtyToAdd = Number(quantity) || 0;
                const updated = await prisma_1.default.inventory.update({
                    where: { id: existing.id },
                    data: {
                        quantity: { increment: qtyToAdd },
                        category: category || existing.category,
                        min_threshold: min_threshold !== undefined ? Number(min_threshold) : existing.min_threshold,
                        lastModifiedBy: performedByName
                    }
                });
                // Create Log (Restock or Adjustment)
                if (qtyToAdd !== 0) {
                    await prisma_1.default.inventoryLog.create({
                        data: {
                            itemId: existing.id,
                            itemName: existing.item_name,
                            office: existing.office_location,
                            change: qtyToAdd,
                            type: qtyToAdd > 0 ? 'Restock' : 'Adjustment',
                            reason: 'Bulk Update',
                            performedBy: performedByName
                        }
                    });
                }
                results.push({ status: 'updated', item: updated, change: qtyToAdd });
            }
            else {
                // Create New
                const newItem = await prisma_1.default.inventory.create({
                    data: {
                        item_name,
                        category: category || 'General',
                        office_location,
                        quantity: Number(quantity) || 0,
                        min_threshold: Number(min_threshold) || 5,
                        lastModifiedBy: performedByName
                    }
                });
                // Log Creation
                await prisma_1.default.inventoryLog.create({
                    data: {
                        itemId: newItem.id,
                        itemName: newItem.item_name,
                        office: newItem.office_location,
                        change: Number(quantity) || 0,
                        type: 'Restock', // Initial Stock
                        reason: 'Initial Create (Bulk)',
                        performedBy: performedByName
                    }
                });
                results.push({ status: 'created', item: newItem, change: Number(quantity) || 0 });
            }
        }
        // Send Email Notification
        email_1.default.sendStockUpdateNotification(results, performedByName)
            .catch(err => console.error("Failed to send stock update email:", err));
        res.json({ message: 'Bulk processing complete', results });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/inventory - Create inventory item
router.post('/', auth_1.requireAdmin, async (req, res) => {
    try {
        const { item_name, category, office_location, quantity, min_threshold } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user?.userId } });
        const performedByName = user?.name || user?.email || 'Admin';
        const item = await prisma_1.default.inventory.create({
            data: {
                item_name,
                category,
                office_location,
                quantity: quantity || 0,
                min_threshold: min_threshold || 5,
                lastModifiedBy: performedByName
            }
        });
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// PATCH /api/inventory/:id - Update inventory item (stock level)
router.patch('/:id', auth_1.requireAdmin, async (req, res) => {
    try {
        const { quantity, min_threshold } = req.body;
        const data = {};
        if (quantity !== undefined)
            data.quantity = quantity;
        if (min_threshold !== undefined)
            data.min_threshold = min_threshold;
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user?.userId } });
        data.lastModifiedBy = user?.name || user?.email || 'Admin';
        const item = await prisma_1.default.inventory.update({
            where: { id: String(req.params.id) },
            data
        });
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// POST /api/inventory/logs - Create inventory log
router.post('/logs', auth_1.requireAdmin, async (req, res) => {
    try {
        const { itemId, itemName, office, change, type, reason, performedBy } = req.body;
        const log = await prisma_1.default.inventoryLog.create({
            data: {
                itemId,
                itemName,
                office,
                change,
                type,
                reason: reason || null,
                performedBy: performedBy || null
            }
        });
        res.json(log);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// DELETE /api/inventory/:id - Delete inventory item
router.delete('/:id', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.inventory.delete({
            where: { id: String(req.params.id) }
        });
        res.json({ message: 'Item deleted' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map