import app from './app';
import { scheduleBackups } from './lib/backup';
import { startLowStockCron } from './cron/lowStock';
import dotenv from 'dotenv'; // Ensure environment variables are loaded if not already

import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { logger } from './lib/logger';

// Global Error Handlers
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3001;

logger.info(`Starting server on port ${PORT}...`);

// Start the server
app.listen(Number(PORT), '0.0.0.0', async () => {
  // Start Cron Jobs (Only on persistent server)
  await scheduleBackups();
  startLowStockCron();

  logger.info(`Server running on port ${PORT}`);

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


export default app;