import cron from 'node-cron';
import prisma from '../lib/prisma';
import emailService from '../lib/email';

export const startLowStockCron = () => {
    // Run every day at 10 AM
    cron.schedule('0 10 * * *', async () => {
        console.log('Running Low Stock Cron Job...');
        try {
            const allItems = await prisma.inventory.findMany();

            const criticalItems = allItems.filter(item => {
                // Ignore if threshold is 0 (User disabled alert)
                if (item.min_threshold === 0) return false;
                // Alert if quantity is <= threshold
                return item.quantity <= item.min_threshold;
            });

            const itemsToAlert = [];

            for (const item of criticalItems) {
                // Check if we alerted recently (within 2 weeks)
                const twoWeeksAgo = new Date();
                twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

                if (!item.lastLowStockEmail || new Date(item.lastLowStockEmail) < twoWeeksAgo) {
                    itemsToAlert.push(item);
                }
            }

            if (itemsToAlert.length > 0) {
                // Use centralized email service
                await emailService.sendLowStockAlert(itemsToAlert);

                // Update lastLowStockEmail for these items
                const now = new Date();
                await prisma.inventory.updateMany({
                    where: {
                        id: { in: itemsToAlert.map(i => i.id) }
                    },
                    data: {
                        lastLowStockEmail: now
                    }
                });
                console.log(`Sent low stock alerts for ${itemsToAlert.length} items`);
            } else {
                console.log('No new low stock alerts to send.');
            }

        } catch (error) {
            console.error('Error in Low Stock Cron:', error);
        }
    });

    console.log('Low Stock Cron Job scheduled.');
};
