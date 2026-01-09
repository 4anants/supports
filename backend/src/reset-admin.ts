import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdmin() {
    console.log('🔄 Resetting Admin Credentials...');

    // Hash new password
    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    // Upsert Admin User
    const admin = await prisma.user.upsert({
        where: { email: 'admin@asepltd.com' },
        update: {
            password: hashedPassword,
            role: 'Admin' // Ensure role is correct
        },
        create: {
            email: 'admin@asepltd.com',
            username: 'admin',
            name: 'System Administrator',
            password: hashedPassword,
            role: 'Admin'
        }
    });

    console.log('✅ Admin reset successful!');
    console.log('   Email: admin@asepltd.com');
    console.log('   Pass:  Admin@123');
}

resetAdmin()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
