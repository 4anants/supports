const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

// Ensure absolute DB path
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

const prisma = new PrismaClient();

async function reset() {
    const email = 'admin@support.com';
    const newPassword = 'admin123';

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
        console.log(`Successfully updated password for ${email}`);
        console.log(`New Password: ${newPassword}`);
    } catch (e) {
        if (e.code === 'P2025') {
            console.log('User not found, creating admin...');
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'ADMIN'
                }
            });
            console.log('Admin user created.');
        } else {
            console.error('Error updating password:', e);
        }
    } finally {
        await prisma.$disconnect();
    }
}

reset();
