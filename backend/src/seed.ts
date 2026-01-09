import prisma from './lib/prisma';
import { hashPassword } from './lib/auth';

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPassword = await hashPassword('Admin@123');
    const admin = await prisma.user.upsert({
        where: { email: 'admin@asepltd.com' },
        update: { password: adminPassword },
        create: {
            email: 'admin@asepltd.com',
            username: 'admin',
            name: 'System Administrator',
            password: adminPassword,
            role: 'Admin'
        }
    });
    console.log('✅ Admin user created:', admin.email);

    // Create IT support user  
    const supportPassword = await hashPassword('Support@123');
    const support = await prisma.user.upsert({
        where: { email: 'support@asepltd.com' },
        update: { password: supportPassword },
        create: {
            email: 'support@asepltd.com',
            username: 'itsupport',
            name: 'IT Support',
            password: supportPassword,
            role: 'IT Support'
        }
    });
    console.log('✅ Support user created:', support.email);

    // Create offices
    const officeNames = ['HYD', 'AMD', 'VA', 'MD', 'WIN', 'El Salvador'];
    for (const name of officeNames) {
        await prisma.office.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }
    console.log('✅ Offices created');

    // Create departments
    const deptData = [
        { name: 'Structural', order: 1 },
        { name: 'Mechanical', order: 2 },
        { name: 'Electrical', order: 3 },
        { name: 'Plumbing', order: 4 },
        { name: 'BIM', order: 5 },
        { name: 'HBS', order: 6 },
        { name: 'EVG', order: 7 },
        { name: 'HR', order: 8 },
        { name: 'IT', order: 9 }
    ];

    for (const dept of deptData) {
        await prisma.department.upsert({
            where: { name: dept.name },
            update: {},
            create: dept
        });
    }
    console.log('✅ Departments created');

    // Create default settings
    const defaultSettings = [
        { key: 'company_name', value: 'IT Support Portal' },
        { key: 'logo_url', value: '' },
        { key: 'background_url', value: '' }
    ];

    for (const setting of defaultSettings) {
        await prisma.settings.upsert({
            where: { key: setting.key },
            update: {},
            create: setting
        });
    }
    console.log('✅ Settings created');

    // Create some inventory items if none exist
    const inventoryCount = await prisma.inventory.count();
    if (inventoryCount === 0) {
        const inventoryItems = [
            { item_name: 'Dell Monitor 24"', category: 'Hardware', office_location: 'HYD', quantity: 10 },
            { item_name: 'Logitech Mouse', category: 'Peripheral', office_location: 'HYD', quantity: 50 },
            { item_name: 'Mechanical Keyboard', category: 'Peripheral', office_location: 'AMD', quantity: 15 }
        ];

        for (const item of inventoryItems) {
            await prisma.inventory.create({
                data: item
            });
        }
        console.log('✅ Inventory seeded');
    }

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('Default Users:');
    console.log('  Admin:   admin@asepltd.com / Admin@123');
    console.log('  Support: support@asepltd.com / Support@123\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
