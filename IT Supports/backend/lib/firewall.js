"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firewall = void 0;
const prisma_1 = __importDefault(require("./prisma"));
class FirewallService {
    allowed = new Set();
    blocked = new Set();
    recentBlocks = new Map();
    async loadSettings() {
        try {
            const settings = await prisma_1.default.settings.findMany({
                where: { key: { in: ['allowed_ips', 'blocked_ips'] } }
            });
            const allowedStr = settings.find(s => s.key === 'allowed_ips')?.value || '';
            this.allowed = new Set(allowedStr.split(',').map((s) => s.trim()).filter(Boolean));
            const blockedStr = settings.find(s => s.key === 'blocked_ips')?.value || '';
            this.blocked = new Set(blockedStr.split(',').map((s) => s.trim()).filter(Boolean));
            console.log(`🔥 Firewall Rules Loaded: ${this.allowed.size} allowed, ${this.blocked.size} blocked`);
        }
        catch (error) {
            // Silently fail in serverless environment - firewall will use empty sets
            console.warn('Firewall settings not loaded (serverless mode)');
        }
    }
    isAllowed(ip) {
        return this.allowed.has(ip);
    }
    isBlocked(ip) {
        return this.blocked.has(ip);
    }
    recordBlock(ip, reason = 'Rate Limit Exceeded') {
        this.recentBlocks.set(ip, { timestamp: new Date(), reason });
        // Keep map size manageable (max 100 recent)
        if (this.recentBlocks.size > 100) {
            const firstKey = this.recentBlocks.keys().next().value;
            if (firstKey)
                this.recentBlocks.delete(firstKey);
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
exports.firewall = new FirewallService();
//# sourceMappingURL=firewall.js.map