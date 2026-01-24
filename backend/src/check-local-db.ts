import Database from 'better-sqlite3';
import path from 'path';

const dbs = ['prod.db', 'prod_bak.db'];

for (const dbName of dbs) {
    const dbPath = path.join(__dirname, '../', dbName);
    console.log(`\n📂 Checking ${dbName}...`);
    try {
        const db = new Database(dbPath, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'").all() as { name: string }[];

        for (const { name } of tables) {
            const count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number };
            console.log(`   - ${name}: ${count.c} rows`);
        }
    } catch (e: any) {
        console.error(`   ❌ Error: ${e.message}`);
    }
}
