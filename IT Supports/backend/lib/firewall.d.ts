declare class FirewallService {
    private allowed;
    private blocked;
    private recentBlocks;
    loadSettings(): Promise<void>;
    isAllowed(ip: string): boolean;
    isBlocked(ip: string): boolean;
    recordBlock(ip: string, reason?: string): void;
    getRecentBlocks(): {
        timestamp: Date;
        reason: string;
        ip: string;
    }[];
    getAllowed(): string[];
    getBlocked(): string[];
}
export declare const firewall: FirewallService;
export {};
