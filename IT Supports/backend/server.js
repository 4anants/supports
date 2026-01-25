"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const backup_1 = require("./lib/backup");
const lowStock_1 = require("./cron/lowStock");
const dotenv_1 = __importDefault(require("dotenv")); // Ensure environment variables are loaded if not already
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const logger_1 = require("./lib/logger");
// Global Error Handlers
process.on('uncaughtException', (err) => {
    logger_1.logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    logger_1.logger.error('UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
});
const PORT = process.env.PORT || 3001;
logger_1.logger.info(`Starting server on port ${PORT}...`);
// Start the server
app_1.default.listen(Number(PORT), '0.0.0.0', async () => {
    // Start Cron Jobs (Only on persistent server)
    await (0, backup_1.scheduleBackups)();
    (0, lowStock_1.startLowStockCron)();
    logger_1.logger.info(`Server running on port ${PORT}`);
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  IT Support System - Backend API     ║
    ╠═══════════════════════════════════════╣
    ║  Port:     ${PORT}                      ║
    ║  Database: Turso (LibSQL)             ║
    ║  Storage:  Cloudinary                 ║
    ╠═══════════════════════════════════════╣
    ║  Frontend: http://localhost:3002          ║
    ║  API:      http://localhost:${PORT}/api           ║
    ╚═══════════════════════════════════════╝
      `);
});
exports.default = app_1.default;
//# sourceMappingURL=server.js.map