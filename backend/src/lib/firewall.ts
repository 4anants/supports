import prisma from './prisma';

class FirewallService {
    private allowed: Set<string> = new Set();
    private blocked: Set<string> = new Set();
    private recentBlocks: Map<string, { timestamp: Date, reason: string }> = new Map();

    async loadSettings() {
        try {
            const settings = await prisma.settings.findMany({
                where: { key: { in: ['allowed_ips', 'blocked_ips'] } }
            });

            const allowedStr = settings.find(s => s.key === 'allowed_ips')?.value || '';
            this.allowed = new Set(allowedStr.split(',').map((s: string) => s.trim()).filter(Boolean));

            const blockedStr = settings.find(s => s.key === 'blocked_ips')?.value || '';
            this.blocked = new Set(blockedStr.split(',').map((s: string) => s.trim()).filter(Boolean));

            console.log(`🔥 Firewall Rules Loaded: ${this.allowed.size} allowed, ${this.blocked.size} blocked`);
        } catch (error) {
            console.error('Failed to load firewall settings:', error);
        }
    }

    isAllowed(ip: string): boolean {
        return this.allowed.has(ip);
    }

    isBlocked(ip: string): boolean {
        return this.blocked.has(ip);
    }

    recordBlock(ip: string, reason: string = 'Rate Limit Exceeded') {
        this.recentBlocks.set(ip, { timestamp: new Date(), reason });

        // Keep map size manageable (max 100 recent)
        if (this.recentBlocks.size > 100) {
            const firstKey = this.recentBlocks.keys().next().value;
            if (firstKey) this.recentBlocks.delete(firstKey);
        }
    }

    getRecentBlocks() {
        // Convert map to array details
        return Array.from(this.recentBlocks.entries())
            .map(([ip, data]) => ({ ip, ...data }))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getAllowed() { return Array.from(this.allowed); }
    getBlocked() { return Array.from(this.blocked); }
}

export const firewall = new FirewallService();
