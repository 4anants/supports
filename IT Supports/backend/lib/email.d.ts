declare class EmailService {
    private getTransporter;
    sendEmail(to: string | string[], subject: string, html: string): Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
    private getFrontendUrl;
    private getBackendUrl;
    private getTeamEmails;
    private formatTemplate;
    private escapeHtml;
    private calculateDuration;
    private generateCardHtml;
    sendTicketNotification(ticket: any): Promise<void>;
    sendUpdateNotification(ticket: any): Promise<void>;
    sendTestEmail(to: string): Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
    sendStockUpdateNotification(updates: any[], performedBy: string): Promise<void>;
    sendLowStockAlert(items: any[]): Promise<void>;
    verifyConnection(): Promise<true>;
}
declare const _default: EmailService;
export default _default;
