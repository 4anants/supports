"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function check() {
    try {
        console.log("--- USERS ---");
        const users = await prisma.user.findMany();
        console.log(users);
        console.log("\n--- SETTINGS ---");
        const settings = await prisma.settings.findMany();
        console.log(settings);
    }
    catch (e) {
        console.error(e);
    }
    finally {
        await prisma.$disconnect();
    }
}
check();
//# sourceMappingURL=debug-check.js.map