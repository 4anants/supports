import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import prisma from './lib/prisma';
import { hashPassword } from './lib/auth';

async function main() {
    console.log('🌱 Seeding database...');

    // 0. Clear existing users (to avoid unique constraint conflicts on username/email)
    await prisma.user.deleteMany({});

    // 1. Create Admin User
    const adminPassword = await hashPassword('admin123');
    await prisma.user.upsert({
        where: { email: 'admin@localhost.com' },
        update: { password: adminPassword },
        create: {
            email: 'admin@localhost.com',
            username: 'admin',
            name: 'System Administrator',
            password: adminPassword,
            role: 'Admin'
        }
    });

    // 2. Create IT Support User
    await prisma.user.upsert({
        where: { email: 'it@localhost.com' },
        update: { password: adminPassword }, // Same password
        create: {
            email: 'it@localhost.com',
            username: 'itsupport',
            name: 'IT Support Agent',
            password: adminPassword,
            role: 'IT Support'
        }
    });

    console.log('✅ Default users created');

    // 3. Create Offices
    const officeNames = ['Headquarters', 'Branch Office A', 'Branch Office B', 'Warehouse'];
    for (const name of officeNames) {
        await prisma.office.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // 4. Create Departments
    const deptData = [
        { name: 'Administration', order: 1 },
        { name: 'Finance', order: 2 },
        { name: 'Human Resources', order: 3 },
        { name: 'Sales & Marketing', order: 4 },
        { name: 'Operations', order: 5 },
        { name: 'IT', order: 6 }
    ];

    for (const dept of deptData) {
        await prisma.department.upsert({
            where: { name: dept.name },
            update: {},
            create: dept
        });
    }

    // 5. Create Default Settings
    const defaultSettings = [
        { key: 'company_name', value: 'IT Supports' },
        { key: 'logo_url', value: 'https://cdn-icons-png.flaticon.com/512/2920/2920195.png' },
        { key: 'background_url', value: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2000' },
        { key: 'smtp_from_address', value: 'noreply@localhost.com' },
        { key: 'smtp_from_name', value: 'IT Support Team' },
        { key: 'app_url', value: 'http://localhost:3001' }
    ];

    for (const setting of defaultSettings) {
        await prisma.settings.upsert({
            where: { key: setting.key },
            update: { value: setting.value }, // Force update to fix empty/broken values
            create: setting
        });
    }

    // 6. Seed Sample Inventory (Mock Data)
    if ((await prisma.inventory.count()) === 0) {
        const mockInventory = [
            { item_name: 'Dell Latitude Laptop', category: 'Laptop', office_location: 'Headquarters', quantity: 5, min_threshold: 2 },
            { item_name: 'Logitech Wireless Mouse', category: 'Peripheral', office_location: 'Headquarters', quantity: 20, min_threshold: 5 },
            { item_name: 'HDMI Cable (6ft)', category: 'Cable', office_location: 'Branch Office A', quantity: 15, min_threshold: 3 },
            { item_name: '24" Monitor', category: 'Monitor', office_location: 'Warehouse', quantity: 8, min_threshold: 2 },
            { item_name: 'USB-C Docking Station', category: 'Accessory', office_location: 'Headquarters', quantity: 3, min_threshold: 2 }
        ];

        for (const item of mockInventory) {
            await prisma.inventory.create({ data: item });
        }
        console.log('✅ Inventory seeded');
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('-------------------------------------------');
    console.log('Admin User: admin@localhost.com / admin123');
    console.log('IT User:    it@localhost.com    / admin123');
    console.log('-------------------------------------------\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
