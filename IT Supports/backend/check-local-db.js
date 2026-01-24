"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const dbs = ['prod.db', 'prod_bak.db'];
for (const dbName of dbs) {
    const dbPath = path_1.default.join(__dirname, '../', dbName);
    console.log(`\n📂 Checking ${dbName}...`);
    try {
        const db = new better_sqlite3_1.default(dbPath, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'").all();
        for (const { name } of tables) {
            const count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get();
            console.log(`   - ${name}: ${count.c} rows`);
        }
    }
    catch (e) {
        console.error(`   ❌ Error: ${e.message}`);
    }
}
//# sourceMappingURL=check-local-db.js.map