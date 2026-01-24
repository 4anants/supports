
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        console.log("--- USERS ---");
        const users = await prisma.user.findMany();
        console.log(users);

        console.log("\n--- SETTINGS ---");
        const settings = await prisma.settings.findMany();
        console.log(settings);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
