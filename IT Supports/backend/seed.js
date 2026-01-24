"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const prisma_1 = __importDefault(require("./lib/prisma"));
const auth_1 = require("./lib/auth");
async function main() {
    console.log('🌱 Seeding database...');
    // 1. Create Admin User
    const adminPassword = await (0, auth_1.hashPassword)('admin123');
    await prisma_1.default.user.upsert({
        where: { email: 'admin@support.com' },
        update: { password: adminPassword },
        create: {
            email: 'admin@support.com',
            username: 'admin',
            name: 'System Administrator',
            password: adminPassword,
            role: 'Admin'
        }
    });
    // 2. Create IT Support User
    await prisma_1.default.user.upsert({
        where: { email: 'it@support.com' },
        update: { password: adminPassword }, // Same password
        create: {
            email: 'it@support.com',
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
        await prisma_1.default.office.upsert({
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
        await prisma_1.default.department.upsert({
            where: { name: dept.name },
            update: {},
            create: dept
        });
    }
    // 5. Create Default Settings
    const defaultSettings = [
        { key: 'company_name', value: 'IT Support Portal' },
        { key: 'logo_url', value: '/uploads/logo.png' },
        { key: 'background_url', value: '/uploads/background.jpg' },
        { key: 'smtp_from_address', value: 'noreply@support.local' },
        { key: 'smtp_from_name', value: 'IT Support Team' },
        { key: 'app_url', value: 'http://localhost:3002' }
    ];
    for (const setting of defaultSettings) {
        await prisma_1.default.settings.upsert({
            where: { key: setting.key },
            update: {},
            create: setting
        });
    }
    // 6. Seed Sample Inventory (Mock Data)
    if ((await prisma_1.default.inventory.count()) === 0) {
        const mockInventory = [
            { item_name: 'Dell Latitude Laptop', category: 'Laptop', office_location: 'Headquarters', quantity: 5, min_threshold: 2 },
            { item_name: 'Logitech Wireless Mouse', category: 'Peripheral', office_location: 'Headquarters', quantity: 20, min_threshold: 5 },
            { item_name: 'HDMI Cable (6ft)', category: 'Cable', office_location: 'Branch Office A', quantity: 15, min_threshold: 3 },
            { item_name: '24" Monitor', category: 'Monitor', office_location: 'Warehouse', quantity: 8, min_threshold: 2 },
            { item_name: 'USB-C Docking Station', category: 'Accessory', office_location: 'Headquarters', quantity: 3, min_threshold: 2 }
        ];
        for (const item of mockInventory) {
            await prisma_1.default.inventory.create({ data: item });
        }
        console.log('✅ Inventory seeded');
    }
    console.log('\n🎉 Seed completed successfully!');
    console.log('-------------------------------------------');
    console.log('Admin User: admin@support.com / admin123');
    console.log('IT User:    it@support.com    / admin123');
    console.log('-------------------------------------------\n');
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma_1.default.$disconnect();
    });
//# sourceMappingURL=seed.js.map