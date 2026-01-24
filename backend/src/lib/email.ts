import nodemailer from 'nodemailer';
import prisma from './prisma';

class EmailService {
  private async getTransporter() {
    // 1. Fetch settings from DB
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['smtp_service', 'smtp_user', 'smtp_pass', 'smtp_host', 'smtp_port', 'smtp_secure']
        }
      }
    });

    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as any);

    // 2. Prioritize DB values, fallback to ENV
    const service = config.smtp_service || process.env.SMTP_SERVICE;
    const user = config.smtp_user || process.env.SMTP_USER;
    const pass = config.smtp_pass || process.env.SMTP_PASS;
    const host = config.smtp_host || process.env.SMTP_HOST || 'localhost';
    const port = parseInt(config.smtp_port || process.env.SMTP_PORT || '1025');
    const secure = (config.smtp_secure === 'true' || process.env.SMTP_SECURE === 'true');

    console.log(`📧 Creating Transporter: Service=${service || 'Custom'}, Host=${host}, Port=${port}, Secure=${secure}, User=${user ? 'Yes' : 'No'}`);

    if (service) {
      return nodemailer.createTransport({
        service,
        auth: { user, pass }
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false }
    });
  }

  async sendEmail(to: string | string[], subject: string, html: string) {
    const transporter = await this.getTransporter();

    // Fetch sender info from DB or ENV
    const fromAddr = await prisma.settings.findUnique({ where: { key: 'smtp_from_address' } });
    const fromName = await prisma.settings.findUnique({ where: { key: 'smtp_from_name' } });

    const info = await transporter.sendMail({
      from: {
        name: fromName?.value || process.env.SMTP_FROM_NAME || 'IT Support',
        address: fromAddr?.value || process.env.SMTP_FROM_ADDRESS || 'noreply@support.local'
      },
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  }

  private async getFrontendUrl() {
    const setting = await prisma.settings.findUnique({ where: { key: 'app_url' } });
    return setting?.value || 'http://localhost:3002';
  }

  private getBackendUrl() {
    return process.env.API_URL || 'http://localhost:3003';
  }

  private async getTeamEmails() {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['Admin', 'IT Support'] }
      },
      select: { email: true }
    });
    return users.map(u => u.email);
  }

  private formatTemplate(title: string, content: string, color: string = '#2563eb') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
              /* Mobile styles */
              @media only screen and (max-width: 600px) {
                  .container { width: 100% !important; max-width: 600px !important; }
                  .content { padding: 20px !important; }
              }
          </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f3f4f6">
              <tr>
                  <td align="center" style="padding: 40px 0;">
                      <table border="0" cellpadding="0" cellspacing="0" width="600" bgcolor="#ffffff" style="max-width: 600px; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 0 auto;">
                          <!-- Header -->
                          <tr>
                              <td align="center" bgcolor="${color}" style="padding: 30px; color: #ffffff;">
                                  <h1 style="margin: 0; font-size: 24px;">${title}</h1>
                              </td>
                          </tr>
                          
                          <!-- Content -->
                          <tr>
                              <td style="padding: 40px 30px; color: #333333;">
                                  ${content}
                              </td>
                          </tr>
                          
                          <!-- Footer -->
                          <tr>
                              <td align="center" bgcolor="#f8fafc" style="padding: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
                                  <p style="margin: 0;">IT Support Portal</p>
                                  <p style="margin: 5px 0 0;">This is an automated notification.</p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `;
  }

  // Helper to escape HTML characters
  private escapeHtml(text: any): string {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private calculateDuration(start: string | Date, end: string | Date) {
    if (!start || !end) return '-';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - startTime;
    if (isNaN(diff) || diff < 0) return '-';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  private generateCardHtml(ticket: any, titleSub: string, backendUrl: string, frontendUrl: string, actionUrl: string, actionText: string, secondaryActionUrl?: string, secondaryActionText?: string) {
    const agentName = ticket.resolved_by || 'IT Support';
    const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';
    const startTime = ticket.reopened_at || ticket.created;
    const duration = isResolved ? this.calculateDuration(startTime, ticket.resolved_at) : '';

    const content = `
        <div style="font-size: 18px; margin-bottom: 20px; font-weight: 600;">
             ${titleSub}: <span style="color: #2563eb;">${this.escapeHtml(ticket.generated_id)}</span>
        </div>
        
        <!-- Ticket Details Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
            <tr>
                <td style="padding: 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Requester</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${this.escapeHtml(ticket.full_name)}</td>
                         </tr>
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Status</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${this.escapeHtml(ticket.status)}</td>
                         </tr>
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Submitted</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${new Date(ticket.created).toLocaleDateString()}</td>
                         </tr>
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Host / IP</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${this.escapeHtml(ticket.computer_name || '-')} / ${this.escapeHtml(ticket.ip_address || '-')}</td>
                         </tr>
                         ${isResolved ? `
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Resolved</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${new Date(ticket.resolved_at).toLocaleDateString()}</td>
                         </tr>
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Duration</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${duration}</td>
                         </tr>
                         ` : ''}
                    </table>
                </td>
            </tr>
        </table>
        
        <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;">Description</div>
        <div style="background-color: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 15px; border-radius: 4px; color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">
            ${this.escapeHtml(ticket.description || 'No description provided')}
        </div>

        ${ticket.admin_remarks ? `
        <div style="margin-top: 20px;">
             <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;">Admin Remarks</div>
             <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 15px; color: #1e40af; font-size: 14px;">
                 <strong>${this.escapeHtml(agentName)}:</strong> ${this.escapeHtml(ticket.admin_remarks)}
             </div>
        </div>
        ` : ''}

        ${ticket.attachment_path ? `
        <div style="margin-top: 20px; text-align: center;">
             <a href="${backendUrl}${ticket.attachment_path}" style="color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: none;">📎 View Attached File</a>
        </div>` : ''}

        <div style="margin-top: 35px; text-align: center;">
            <a href="${actionUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">${actionText}</a>
            
            ${secondaryActionUrl ? `
            <div style="margin-top: 15px;">
                <a href="${secondaryActionUrl}" style="color: #64748b; font-size: 13px; font-weight: 600; text-decoration: none;">${secondaryActionText}</a>
            </div>
            ` : ''}
        </div>
    `;

    return this.formatTemplate(titleSub === 'New Ticket Details' ? 'New Ticket' : 'Ticket Update', content, isResolved ? '#10b981' : '#2563eb');
  }

  async sendTicketNotification(ticket: any) {
    const frontendUrl = await this.getFrontendUrl();
    const backendUrl = this.getBackendUrl();
    const teamEmails = await this.getTeamEmails();

    // User Content (Link to Tracker)
    const cardContentUser = this.generateCardHtml(ticket, 'New Ticket Details', backendUrl, frontendUrl, `${frontendUrl}/track/${ticket.generated_id}`, 'Open Ticket Tracker');

    // Admin Content (Link to Dashboard)
    const cardContentAdmin = this.generateCardHtml(ticket, 'New Ticket Details', backendUrl, frontendUrl, `${frontendUrl}/`, 'Open Admin Dashboard');

    // 1. Send to User
    await this.sendEmail(ticket.requester_email, `[Received] Ticket: ${ticket.generated_id}`, cardContentUser);

    // 2. Send to Team
    if (teamEmails.length > 0) {
      await this.sendEmail(teamEmails, `[New Ticket] ${ticket.generated_id} - ${ticket.department || 'General'}`, cardContentAdmin);
    }
  }


  async sendUpdateNotification(ticket: any) {
    const frontendUrl = await this.getFrontendUrl();
    const backendUrl = this.getBackendUrl();
    const teamEmails = await this.getTeamEmails();

    const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';
    const secondaryUrl = isResolved ? `${frontendUrl}/track/${ticket.generated_id}?reopen=true` : undefined;
    const secondaryText = isResolved ? 'Reopen Ticket' : undefined;

    // User Content (Link to Tracker)
    const cardContentUser = this.generateCardHtml(ticket, 'Ticket Status Update', backendUrl, frontendUrl, `${frontendUrl}/track/${ticket.generated_id}`, 'Open Ticket Tracker', secondaryUrl, secondaryText);

    // Admin Content (Link to Dashboard)
    const cardContentAdmin = this.generateCardHtml(ticket, 'Ticket Status Update', backendUrl, frontendUrl, `${frontendUrl}/`, 'Open Admin Dashboard', secondaryUrl, secondaryText);

    // 1. Send to User
    await this.sendEmail(ticket.requester_email, `[Update] ${ticket.generated_id}: ${ticket.status}`, cardContentUser);

    // 2. Send to Team
    if (teamEmails.length > 0) {
      await this.sendEmail(teamEmails, `[Notify] ${ticket.generated_id} Updated by ${ticket.resolved_by || 'Admin'}`, cardContentAdmin);
    }
  }

  async sendTestEmail(to: string) {
    const html = this.formatTemplate(
      'SMTP Test Successful',
      `
      <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
          <p style="font-size: 16px; margin-bottom: 30px;"><strong>Congratulations!</strong> Your email system is configured correctly.</p>
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px; text-align: left;">
            <tr>
                <td style="padding: 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Recipient</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${this.escapeHtml(to)}</td>
                         </tr>
                         <tr>
                             <td style="padding-bottom: 12px; color: #64748b; font-size: 14px;">Sent At</td>
                             <td align="right" style="padding-bottom: 12px; font-weight: 600; font-size: 14px;">${new Date().toLocaleString()}</td>
                         </tr>
                    </table>
                </td>
            </tr>
          </table>
      </div>
      `,
      '#2563eb'
    );
    return this.sendEmail(to, '✅ Test Email - IT Support', html);
  }

  async sendStockUpdateNotification(updates: any[], performedBy: string) {
    const frontendUrl = await this.getFrontendUrl();
    const teamEmails = await this.getTeamEmails();

    if (teamEmails.length === 0) return;

    // Filter only meaningful updates (non-zero changes)
    const activeUpdates = updates.filter(u => u.change !== 0);
    if (activeUpdates.length === 0) return;

    // Separate Refills (Positive) and Issues (Negative)
    const refills = activeUpdates.filter(u => u.change > 0);

    // SEND REFILL NOTIFICATION
    if (refills.length > 0) {
      const rows = refills.map(u => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${this.escapeHtml(u.item.item_name)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${this.escapeHtml(u.item.office_location)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #16a34a; text-align: center;">+${u.change}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${u.item.quantity}</td>
          </tr>
        `).join('');

      const content = `
          <p style="margin-bottom: 25px; font-size: 16px;">
            The following items have been <strong>restocked</strong> by <span style="color: #2563eb; font-weight: 600;">${this.escapeHtml(performedBy)}</span>.
          </p>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 14px;">
            <thead>
              <tr style="background: #f0fdf4;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #bbf7d0; color: #166534;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #bbf7d0; color: #166534;">Loc</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #bbf7d0; color: #166534;">Added</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #bbf7d0; color: #166534;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: center;">
            <a href="${frontendUrl}/dashboard/inventory" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">View Inventory</a>
          </div>
      `;

      const html = this.formatTemplate('Inventory Restocked', content, '#16a34a');
      await this.sendEmail(teamEmails, `[Stock Refill] ${refills.length} Items Updated`, html);
    }
  }

  async sendLowStockAlert(items: any[]) {
    const frontendUrl = await this.getFrontendUrl();
    const teamEmails = await this.getTeamEmails();

    if (teamEmails.length === 0 || items.length === 0) return;

    // Consolidate ALL items into ONE Single Email
    const rows = items.map(i => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #fee2e2;"><strong>${this.escapeHtml(i.item_name)}</strong></td>
        <td style="padding: 12px; border-bottom: 1px solid #fee2e2; text-align: center; color: #64748b;">${this.escapeHtml(i.office_location)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #fee2e2; color: #dc2626; font-weight: bold; text-align: center;">${i.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #fee2e2; color: #64748b; text-align: center;">${i.min_threshold}</td>
      </tr>
    `).join('');

    const content = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
        <p style="margin: 0; color: #991b1b; font-weight: 500;">⚠️ Attention Required: The following items have dropped below their minimum stock levels.</p>
      </div>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #fee2e2; border-radius: 8px; overflow: hidden; font-size: 14px;">
        <thead>
          <tr style="background: #fff1f2;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #fecaca; color: #991b1b;">Item</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b;">Loc</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b;">Now</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b;">Min</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top: 30px; text-align: center;">
        <a href="${frontendUrl}/dashboard/inventory" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Restock Now</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
        This report is generated automatically every Monday at 09:00 AM.
      </p>
    `;

    const html = this.formatTemplate('Low Stock Alert', content, '#dc2626');
    await this.sendEmail(teamEmails, `[Alert] Low Stock Report (${items.length} Items)`, html);
  }

  async verifyConnection() {
    const transporter = await this.getTransporter();
    return transporter.verify();
  }
}

export default new EmailService();
