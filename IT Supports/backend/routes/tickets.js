"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const email_1 = __importDefault(require("../lib/email"));
const pin_1 = require("../middleware/pin");
const router = (0, express_1.Router)();
// Debug Middleware to trace routing issues
router.use((req, res, next) => {
    console.log(`[Tickets Router] Incoming: ${req.method} ${req.url}`);
    next();
});
// Public: Track ticket by Generated ID (Placed at TOP to avoid conflicts)
router.get('/track/:id', async (req, res) => {
    console.log(`[API] Executing track route for ID: ${req.params.id}`);
    try {
        const ticket = await prisma_1.default.ticket.findFirst({
            where: { generated_id: req.params.id }
        });
        if (!ticket) {
            console.log('[API] Ticket not found in DB');
            return res.status(404).json({ error: 'Ticket not found' });
        }
        // Return only necessary fields for public tracking
        const publicTicket = {
            generated_id: ticket.generated_id,
            status: ticket.status,
            full_name: ticket.full_name,
            created: ticket.created,
            resolved_at: ticket.resolved_at,
            resolved_by: ticket.resolved_by,
            description: ticket.description,
            attachment_path: ticket.attachment_path,
            admin_remarks: ticket.admin_remarks
        };
        res.json(publicTicket);
    }
    catch (error) {
        console.error('[API] Error in track route:', error);
        res.status(500).json({ error: error.message });
    }
});
// Reopen Ticket (Public)
router.post('/track/:id/reopen', async (req, res) => {
    try {
        console.log(`[API] Reopening ticket: ${req.params.id}`);
        const { reason } = req.body;
        const ticket = await prisma_1.default.ticket.findFirst({
            where: { generated_id: req.params.id }
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
            return res.status(400).json({ error: 'Ticket is already open or in progress' });
        }
        const updatedTicket = await prisma_1.default.ticket.update({
            where: { id: ticket.id },
            data: {
                status: 'Open',
                resolved_at: null,
                reopened_at: new Date(),
                admin_remarks: (ticket.admin_remarks ? ticket.admin_remarks + '\n\n' : '') + `[Reopened by User on ${new Date().toLocaleString()}] Reason: ${reason}`
            }
        });
        await email_1.default.sendUpdateNotification(updatedTicket);
        res.json(updatedTicket);
    }
    catch (error) {
        console.error('[API] Error reopening ticket:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/tickets - List tickets
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status && status !== 'all')
            where.status = status;
        if (search) {
            where.OR = [
                { generated_id: { contains: search } },
                { full_name: { contains: search } },
                { requester_email: { contains: search } },
                { description: { contains: search } }
            ];
        }
        const tickets = await prisma_1.default.ticket.findMany({
            where,
            orderBy: { created: 'desc' }
        });
        res.json(tickets);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /api/tickets/:id - Get single ticket (Authenticated)
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const ticket = await prisma_1.default.ticket.findUnique({
            where: { id: String(req.params.id) }
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /api/tickets - Create ticket (public)
router.post('/', async (req, res) => {
    try {
        const { requester_email, full_name, computer_name, ip_address, department, priority, office, type, description, request_item_type } = req.body;
        if (!description || !requester_email || !full_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        let attachment_path = null;
        // Handle File Upload and Super Compression
        if (req.files && req.files.attachment) {
            const file = req.files.attachment;
            // Validate file type
            const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
            if (!allowedMimes.includes(file.mimetype)) {
                return res.status(400).json({ error: 'Unsupported file type. Please upload an Image, PDF, or ZIP.' });
            }
            const isImage = file.mimetype.startsWith('image/');
            const requestResourceType = isImage ? 'image' : 'raw'; // 'raw' for PDF/ZIP
            // Try Cloudinary Upload First
            const cloudinary = require('../lib/cloudinary').default;
            const fs = require('fs');
            const path = require('path');
            try {
                if (!process.env.CLOUDINARY_CLOUD_NAME) {
                    throw new Error('Cloudinary not configured');
                }
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream({
                        folder: 'support-portal/tickets',
                        resource_type: requestResourceType,
                        // Transformation for images: Resize and Compress
                        ...(isImage && {
                            transformation: [
                                { width: 1200, crop: "limit" },
                                { quality: 60 },
                                { fetch_format: "webp" } // Auto convert to efficient format
                            ]
                        })
                    }, (error, result) => {
                        if (error)
                            reject(error);
                        else
                            resolve(result);
                    });
                    fs.createReadStream(file.tempFilePath).pipe(uploadStream);
                });
                attachment_path = result.secure_url;
            }
            catch (cloudError) {
                console.warn('[API] Cloudinary upload failed or not configured. Using local fallback.', cloudError);
                // Local Fallback
                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }
                // Sanitize filename
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.name);
                const basename = path.basename(file.name, ext).replace(/[^a-zA-Z0-9]/g, '_');
                const cleanFilename = `${basename}-${uniqueSuffix}${ext}`;
                const localPath = path.join(uploadsDir, cleanFilename);
                // file.mv is available from express-fileupload
                await new Promise((resolve, reject) => {
                    file.mv(localPath, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                // Use relative URL for local file
                attachment_path = `/uploads/${cleanFilename}`;
            }
            // Cleanup temp file if it still exists (Cloudinary stream might not consume it fully if failed early, or mv moved it)
            if (fs.existsSync(file.tempFilePath)) {
                try {
                    fs.unlinkSync(file.tempFilePath);
                }
                catch (e) { }
            }
        }
        // Generate Custom Ticket ID
        // Format: [OfficeFirstLetter][H if Hardware]_[FirstName]_[UserSequence]
        // Example: A_Anant_001 or AH_Anant_001
        let officePrefix = office ? office.trim().charAt(0).toUpperCase() : 'G';
        let typePrefix = '';
        if (type === 'HARDWARE_REQUEST' || (request_item_type && request_item_type.length > 0)) {
            typePrefix = 'H';
        }
        const originalNamePart = full_name.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '');
        let namePart = originalNamePart;
        let discriminator = 1;
        // Find a name prefix that is either unused or owned by THIS email
        while (true) {
            const candidateName = discriminator === 1 ? originalNamePart : `${originalNamePart}${discriminator}`;
            const candidatePrefix = `${officePrefix}${typePrefix}_${candidateName}`;
            // Check if this prefix is used by another user
            const conflict = await prisma_1.default.ticket.findFirst({
                where: {
                    generated_id: { startsWith: `${candidatePrefix}_` },
                    requester_email: { not: requester_email }
                }
            });
            if (!conflict) {
                namePart = candidateName;
                break;
            }
            discriminator++;
        }
        const finalPrefix = `${officePrefix}${typePrefix}_${namePart}`;
        // Get sequence based on this specific prefix count
        const prefixCount = await prisma_1.default.ticket.count({
            where: { generated_id: { startsWith: `${finalPrefix}_` } }
        });
        let seq = prefixCount + 1;
        let generated_id = `${finalPrefix}_${seq.toString().padStart(3, '0')}`;
        // Final Collision Check (Race conditions)
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            const existing = await prisma_1.default.ticket.findUnique({
                where: { generated_id }
            });
            if (!existing) {
                isUnique = true;
            }
            else {
                seq++;
                generated_id = `${finalPrefix}_${seq.toString().padStart(3, '0')}`;
                attempts++;
            }
        }
        const ticket = await prisma_1.default.ticket.create({
            data: {
                generated_id,
                requester_email,
                full_name,
                computer_name: computer_name || null,
                ip_address: ip_address || null,
                department: department || null,
                priority: priority || 'Medium',
                office: office || null,
                type: type || 'SUPPORT_ISSUE',
                description,
                request_item_type: request_item_type || null,
                attachment_path,
                status: 'Open'
            }
        });
        // Send email notifications
        try {
            await email_1.default.sendTicketNotification(ticket);
        }
        catch (emailError) {
            console.error('Failed to send email:', emailError);
        }
        res.json(ticket);
    }
    catch (error) {
        console.error('Ticket Creation Error:', error);
        res.status(400).json({ error: error.message });
    }
});
// PATCH /api/tickets/:id - Update ticket (admin only)
router.patch('/:id', auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_remarks, priority } = req.body;
        const updateData = {};
        if (status)
            updateData.status = status;
        if (admin_remarks !== undefined)
            updateData.admin_remarks = admin_remarks;
        if (priority)
            updateData.priority = priority;
        if (req.body.resolved_at)
            updateData.resolved_at = new Date(req.body.resolved_at);
        if (req.body.resolved_by)
            updateData.resolved_by = req.body.resolved_by;
        if (req.body.responded_at)
            updateData.responded_at = new Date(req.body.responded_at);
        // Check if we need to deduct inventory (Transition to Resolved or Closed)
        let performDeduction = false;
        if (status === 'Resolved' || status === 'Closed') {
            const currentTicket = await prisma_1.default.ticket.findUnique({ where: { id: String(id) } });
            if (currentTicket && currentTicket.request_item_type) {
                // Check if we already deducted for this ticket to prevent double counting
                const existingLog = await prisma_1.default.inventoryLog.findFirst({
                    where: {
                        reason: { contains: `Ticket ${currentTicket.generated_id}` }
                    }
                });
                if (!existingLog) {
                    performDeduction = true;
                }
            }
        }
        const ticket = await prisma_1.default.ticket.update({
            where: { id: String(id) },
            data: updateData
        });
        // Automated Inventory Deduction
        if (performDeduction && ticket.request_item_type && ticket.office) {
            try {
                // Find matching inventory item in the same office
                // Case-insensitive matching for item name
                const items = await prisma_1.default.inventory.findMany({
                    where: {
                        office_location: ticket.office
                    }
                });
                const item = items.find(i => i.item_name.toLowerCase() === ticket.request_item_type?.toLowerCase());
                if (item) {
                    // Deduct 1 unit
                    await prisma_1.default.inventory.update({
                        where: { id: item.id },
                        data: {
                            quantity: { decrement: 1 },
                            lastModifiedBy: 'System (Ticket)'
                        }
                    });
                    // Log the transaction
                    await prisma_1.default.inventoryLog.create({
                        data: {
                            itemId: item.id,
                            itemName: item.item_name,
                            office: item.office_location,
                            change: -1,
                            type: 'ISSUE',
                            reason: `Ticket ${ticket.generated_id} - ${ticket.full_name}`,
                            performedBy: 'System (Ticket)'
                        }
                    });
                    console.log(`Auto-deducted 1 ${item.item_name} for Ticket ${ticket.generated_id}`);
                }
            }
            catch (invError) {
                console.error('Failed to auto-deduct inventory:', invError);
                // Don't fail the ticket update if inventory fails
            }
        }
        // Send email notification on update
        try {
            await email_1.default.sendUpdateNotification(ticket);
        }
        catch (emailError) {
            console.error('Failed to send update email:', emailError);
        }
        res.json(ticket);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// DELETE /api/tickets/:id - Delete ticket (admin only)
router.delete('/:id', auth_1.requireAdmin, pin_1.verifyPin, async (req, res) => {
    try {
        await prisma_1.default.ticket.delete({ where: { id: String(req.params.id) } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=tickets.js.map