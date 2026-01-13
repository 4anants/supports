import cron from 'node-cron';
import prisma from '../lib/prisma';
import emailService from '../lib/email';

export const startLowStockCron = () => {
    // Run every Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
        console.log('Running Weekly Low Stock Cron Job...');
        try {
            const allItems = await prisma.inventory.findMany();

            const criticalItems = allItems.filter(item => {
                // Ignore if threshold is 0 (User disabled alert)
                if (item.min_threshold === 0) return false;
                // Alert if quantity is <= threshold
                return item.quantity <= item.min_threshold;
            });

            if (criticalItems.length > 0) {
                // Use centralized email service - Single Email for ALL items
                await emailService.sendLowStockAlert(criticalItems);

                // Update lastLowStockEmail for these items (for audit only, logic no longer depends on it for filtering)
                const now = new Date();
                await prisma.inventory.updateMany({
                    where: {
                        id: { in: criticalItems.map(i => i.id) }
                    },
                    data: {
                        lastLowStockEmail: now
                    }
                });
                console.log(`Sent weekly low stock report for ${criticalItems.length} items`);
            } else {
                console.log('No low stock items found this week.');
            }

        } catch (error) {
            console.error('Error in Low Stock Cron:', error);
        }
    });

    console.log('Weekly Low Stock Cron Job scheduled for Mondays at 09:00.');
};
