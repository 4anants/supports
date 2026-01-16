import app from './app';
import { scheduleBackups } from './lib/backup';
import { startLowStockCron } from './cron/lowStock';
import dotenv from 'dotenv'; // Ensure environment variables are loaded if not already

dotenv.config();

const PORT = process.env.PORT || 3001;

// Only start the server if running directly (not imported)
console.log('Server file loaded.');
if (require.main === module || process.env.START_SERVER === 'true') {
  app.listen(PORT, async () => {
    // Start Cron Jobs (Only on persistent server)
    await scheduleBackups();
    startLowStockCron();

    console.log(`
    ╔═══════════════════════════════════════╗
    ║  IT Support System - Backend API     ║
    ╠═══════════════════════════════════════╣
    ║  Port:     ${PORT}                      ║
    ║  Database: Turso (LibSQL)             ║
    ║  Storage:  Cloudinary                 ║
    ╠═══════════════════════════════════════╣
    ║  http://localhost:${PORT}/api           ║
    ╚═══════════════════════════════════════╝
      `);
  });
}

export default app;