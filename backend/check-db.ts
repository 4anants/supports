import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:d:/GitHub/Supports/backend/prisma/dev.db',
        },
    },
});

async function checkData() {
    try {
        const userCount = await prisma.user.count();
        const officeCount = await prisma.office.count();
        const deptCount = await prisma.department.count();
        const settingsCount = await prisma.settings.count();

        console.log('--- LOCAL DB CHECK ---');
        console.log(`Users: ${userCount}`);
        console.log(`Offices: ${officeCount}`);
        console.log(`Departments: ${deptCount}`);
        console.log(`Settings: ${settingsCount}`);

        const offices = await prisma.office.findMany();
        console.log('Office Names:', offices.map(o => o.name));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
