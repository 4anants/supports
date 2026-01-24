"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function resetAdmin() {
    console.log('🔄 Resetting Admin Credentials...');
    // Hash new password
    const hashedPassword = await bcryptjs_1.default.hash('Admin@123', 10);
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
//# sourceMappingURL=reset-admin.js.map