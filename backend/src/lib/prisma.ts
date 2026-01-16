import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let prisma: PrismaClient;

if (url && url.startsWith('libsql:')) {
    console.log(`🔌 Connecting to Turso (LibSQL)...`);
    const libsql = createClient({
        url,
        authToken,
    });
    const adapter = new PrismaLibSql(libsql as any) as any;
    prisma = globalForPrisma.prisma || new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
} else {
    console.log('🔌 Connecting to Standard SQLite/Postgres...');
    prisma = globalForPrisma.prisma || new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
