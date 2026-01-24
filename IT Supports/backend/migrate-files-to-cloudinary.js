"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cloudinary_1 = __importDefault(require("./lib/cloudinary"));
const client_1 = require("@libsql/client");
const UPLOADS_DIR = path_1.default.join(__dirname, '../uploads');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Missing Turso Credentials');
    process.exit(1);
}
const turso = (0, client_1.createClient)({
    url: TURSO_URL,
    authToken: TURSO_TOKEN
});
async function uploadToCloudinary(filePath) {
    return new Promise((resolve, reject) => {
        cloudinary_1.default.uploader.upload(filePath, {
            folder: 'support-portal/migrated',
            use_filename: true,
            unique_filename: true
        }, (error, result) => {
            if (error)
                reject(error);
            else
                resolve(result.secure_url);
        });
    });
}
async function migrateFiles() {
    console.log('🚀 Starting File Migration (Local -> Cloudinary)...');
    if (!fs_1.default.existsSync(UPLOADS_DIR)) {
        console.log('⚠️ No local uploads directory found.');
        return;
    }
    const files = fs_1.default.readdirSync(UPLOADS_DIR);
    console.log(`📂 Found ${files.length} files in ${UPLOADS_DIR}`);
    for (const file of files) {
        const localPath = path_1.default.join(UPLOADS_DIR, file);
        if (fs_1.default.statSync(localPath).isDirectory())
            continue;
        console.log(`\n📄 Processing: ${file}`);
        try {
            // 1. Upload to Cloudinary
            const cloudUrl = await uploadToCloudinary(localPath);
            console.log(`   ✅ Uploaded: ${cloudUrl}`);
            // 2. Find references in DB and update
            // Check Ticket.attachment_path
            const ticketRes = await turso.execute({
                sql: 'SELECT id FROM Ticket WHERE attachment_path LIKE ?',
                args: [`%${file}%`] // Naive match: if path contained filename
            });
            if (ticketRes.rows.length > 0) {
                console.log(`   🔗 Found ${ticketRes.rows.length} tickets referencing this file.`);
                for (const row of ticketRes.rows) {
                    await turso.execute({
                        sql: 'UPDATE Ticket SET attachment_path = ? WHERE id = ?',
                        args: [cloudUrl, row.id]
                    });
                    console.log(`      Updated Ticket ${row.id}`);
                }
            }
            // Check User.avatar
            const userRes = await turso.execute({
                sql: 'SELECT id FROM User WHERE avatar LIKE ?',
                args: [`%${file}%`]
            });
            if (userRes.rows.length > 0) {
                console.log(`   🔗 Found ${userRes.rows.length} users referencing this file.`);
                for (const row of userRes.rows) {
                    await turso.execute({
                        sql: 'UPDATE User SET avatar = ? WHERE id = ?',
                        args: [cloudUrl, row.id]
                    });
                    console.log(`      Updated User ${row.id}`);
                }
            }
            // Check Settings? (Logo)
            // Settings table has key/value. Key might be 'company_logo'
            const settingRes = await turso.execute({
                sql: 'SELECT id FROM Settings WHERE value LIKE ?',
                args: [`%${file}%`]
            });
            if (settingRes.rows.length > 0) {
                console.log(`   🔗 Found ${settingRes.rows.length} settings referencing this file.`);
                for (const row of settingRes.rows) {
                    await turso.execute({
                        sql: 'UPDATE Settings SET value = ? WHERE id = ?',
                        args: [cloudUrl, row.id]
                    });
                    console.log(`      Updated Setting ${row.id}`);
                }
            }
        }
        catch (error) {
            console.error(`   ❌ Error migrating ${file}:`, error.message);
        }
    }
    console.log('\n🎉 File Migration Complete!');
}
migrateFiles();
//# sourceMappingURL=migrate-files-to-cloudinary.js.map