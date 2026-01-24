const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Force absolute path to the DB to avoid any relative path issues
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
// Fix slashes for Windows URL
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

console.log(`Using Database URL: ${dbUrl}`);

process.env.DATABASE_URL = dbUrl;

const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany();
        console.log('--- Users in Database ---');
        if (users.length === 0) {
            console.log('No users found.');
        } else {
            users.forEach(u => {
                console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Name: ${u.firstName} ${u.lastName}`);
            });
        }
    } catch (e) {
        console.error('Error fetching users:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
