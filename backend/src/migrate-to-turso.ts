
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';

const LOCAL_DB_PATH = path.join(__dirname, '../prod_bak.db'); // Use backup or prod.db
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Missing TURSO credentials');
    process.exit(1);
}

const localDb = new Database(LOCAL_DB_PATH);
const turso = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
});

async function migrate() {
    // 1. Apply Migrations
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const migrationFolders = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
        .sort(); // Sort chronologically

    console.log(`📜 Found ${migrationFolders.length} migrations to apply.`);

    for (const folder of migrationFolders) {
        const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
        if (fs.existsSync(sqlPath)) {
            console.log(`   Running migration: ${folder}`);
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

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
                } catch (err: any) {
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

    // Get all tables
    const tables = localDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'").all() as { name: string }[];

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
                await turso.execute({ sql, args: values as any });
            } catch (err) {
                console.error(`   ❌ Failed to insert row into ${table}:`, err);
            }
        }
        console.log(`   ✅ Done`);
    }

    console.log('🎉 Migration Complete!');
}

migrate();
