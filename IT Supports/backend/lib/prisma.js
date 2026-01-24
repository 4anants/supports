"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const client_2 = require("@libsql/client");
const adapter_libsql_1 = require("@prisma/adapter-libsql");
const globalForPrisma = global;
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
let prisma;
if (url && (url.startsWith('libsql:') || url.startsWith('wss:'))) {
    console.log(`🔌 Initializing LibSQL adapter for: ${url}`);
    try {
        const libsql = (0, client_2.createClient)({
            url: url,
            authToken: authToken,
        });

        if (!libsql) {
            throw new Error('Failed to create LibSQL client object');
        }

        const adapter = new adapter_libsql_1.PrismaLibSql(libsql);
        prisma = globalForPrisma.prisma || new client_1.PrismaClient({ adapter });
        console.log('✅ PrismaClient initialized with LibSQL adapter');
    }
    catch (e) {
        console.error('❌ Failed to initialize LibSQL adapter:', e.message);
        console.log('🔄 Falling back to standard PrismaClient...');
        prisma = globalForPrisma.prisma || new client_1.PrismaClient();
    }
}
else {
    console.log('🔌 Connecting to Standard SQLite/Postgres...');
    prisma = globalForPrisma.prisma || new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
}
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map