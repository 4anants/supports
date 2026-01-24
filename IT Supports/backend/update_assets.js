const { PrismaClient } = require('@prisma/client');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

const prisma = new PrismaClient();

async function updateSettings() {
    try {
        await prisma.settings.upsert({
            where: { key: 'logo_url' },
            update: { value: '/uploads/logo.png' },
            create: { key: 'logo_url', value: '/uploads/logo.png' }
        });

        await prisma.settings.upsert({
            where: { key: 'background_url' },
            update: { value: '/uploads/background.jpg' },
            create: { key: 'background_url', value: '/uploads/background.jpg' }
        });

        // Also ensure app_url is correct just in case (Port 3003)
        await prisma.settings.upsert({
            where: { key: 'app_url' },
            update: { value: 'http://localhost:3003' },
            create: { key: 'app_url', value: 'http://localhost:3003' }
        });

        console.log('Settings updated to use local assets.');
    } catch (e) {
        console.error('Error updating settings:', e);
    } finally {
        await prisma.$disconnect();
    }
}

updateSettings();
