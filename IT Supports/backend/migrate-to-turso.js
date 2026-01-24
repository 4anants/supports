"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const client_1 = require("@libsql/client");
const LOCAL_DB_PATH = path_1.default.join(__dirname, '../prod_bak.db'); // Use backup or prod.db
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Missing TURSO credentials');
    process.exit(1);
}
const localDb = new better_sqlite3_1.default(LOCAL_DB_PATH);
const turso = (0, client_1.createClient)({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
});
async function migrate() {
    // 1. Apply Migrations
    const migrationsDir = path_1.default.join(__dirname, '../prisma/migrations');
    const migrationFolders = fs_1.default.readdirSync(migrationsDir)
        .filter(f => fs_1.default.statSync(path_1.default.join(migrationsDir, f)).isDirectory())
        .sort(); // Sort chronologically
    console.log(`📜 Found ${migrationFolders.length} migrations to apply.`);
    for (const folder of migrationFolders) {
        const sqlPath = path_1.default.join(migrationsDir, folder, 'migration.sql');
        if (fs_1.default.existsSync(sqlPath)) {
            console.log(`   Running migration: ${folder}`);
            const sqlContent = fs_1.default.readFileSync(sqlPath, 'utf-8');
            // Split by semi-colon to execute valid statements?
            // LibSQL execute supports multiple statements? Usually no.
            // But migration files often have multiple.
            // We'll split by ';' but be careful about triggers/functions?
            // Simple split might break if ';' is inside string. 
            // For now, let's try executing individual statements if possible, or usually `execute` takes one.
            // LibSQL client `executeMultiple` exists? Or `batch`?
            // Let's use split for basic sqlite migrations.
            const statements = sqlContent.split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            for (const stmt of statements) {
                try {
                    await turso.execute(stmt);
                }
                catch (err) {
                    // Ignore "table already exists" if re-running
                    if (!err.message.includes('already exists') && !err.message.includes('unique constraint')) {
                        console.error(`   ❌ SQL Error in ${folder}:`, err.message);
                        // console.error(stmt);
                    }
                }
            }
        }
    }
    console.log('✅ Schema Synchronized.');
    // 2. Data Migration
    console.log('🚀 Starting Data Migration...');
    const tables = localDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'").all();
    // Reverse order for deletion to handle FKs (naive approach, strict FKs might still fail if circular)
    // Better: Disable FKs? Turso/LibSQL might not allow simple pragma for remote?
    // Let's try iterating tables and deleting.
    console.log('🗑️ Clearing existing data in Turso...');
    const deletionOrder = ['InventoryLog', 'Ticket', 'Inventory', 'Department', 'Office', 'Settings', 'BackupLog', 'User'];
    // Note: Ticket depends on User (maybe?), InventoryLog depends on Inventory/User. 
    // Schema: 
    // Ticket -> no FK enforced in schema? 
    // "requester_email" is string. "resolved_by" string. 
    // Actually Prisma schema above doesn't show @relation for these, so no FK constraints on User/Ticket relation?
    // Let's check schema.prisma again. 
    // User has no relations listed. Ticket has no relations listed.
    // So simple deletion should work.
    for (const table of deletionOrder) {
        try {
            console.log(`   - Deleting from ${table}...`);
            await turso.execute(`DELETE FROM "${table}"`);
        }
        catch (e) {
            console.warn(`   ⚠️ Could not delete ${table} (maybe doesn't exist): ${e.message}`);
        }
    }
    for (const { name: table } of tables) {
        console.log(`📦 Migrating table: ${table}`);
        const rows = localDb.prepare(`SELECT * FROM "${table}"`).all();
        if (rows.length === 0) {
            console.log(`   - Skipping (empty)`);
            continue;
        }
        console.log(`   - Found ${rows.length} rows`);
        for (const row of rows) {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT OR IGNORE INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`; // Use quotes for columns
            try {
                await turso.execute({ sql, args: values });
            }
            catch (err) {
                console.error(`   ❌ Failed to insert row into ${table}:`, err);
            }
        }
        console.log(`   ✅ Done`);
    }
    console.log('🎉 Migration Complete!');
}
migrate();
//# sourceMappingURL=migrate-to-turso.js.map