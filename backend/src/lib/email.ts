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
    return setting?.value || 'http://localhost:3000';
  }

  private getBackendUrl() {
    return process.env.API_URL || 'http://localhost:3001';
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
      <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f6f8; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: ${color}; color: white; padding: 25px; text-align: center; }
          .content { padding: 30px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6a737d; border-top: 1px solid #e1e4e8; }

          /* Table Styles for Details */
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table td { padding: 10px; border-bottom: 1px solid #f1f1f1; vertical-align: top; font-size: 14px; }
          .details-table tr:last-child td { border-bottom: none; }
          .label-col { width: 30%; font-weight: bold; color: #555; text-align: right; padding-right: 15px; background-color: #fcfcfc; }
          .sep-col { width: 20px; text-align: center; color: #999; }
          .value-col { text-align: left; color: #111; font-weight: 500; }
          
          .btn { display: inline-block; padding: 12px 24px; background: ${color}; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 25px; text-align: center; }
          .remarks { background: #fffdf0; border-left: 4px solid #ffd33d; padding: 15px; margin-top: 15px; font-style: italic; font-size: 14px; }
      </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1 style="margin:0; font-size: 22px;">${title}</h1></div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">IT Support System - Automated Notification</div>
        </div>
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

  private generateCardHtml(ticket: any, titleSub: string, backendUrl: string, frontendUrl: string) {
    const agentName = ticket.resolved_by || 'IT Support';

    return `
      <div style="background-color: #f3f4f6; padding: 40px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); padding: 30px;">
                <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td>
                            <div style="color: #bfdbfe; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${titleSub}</div>
                            <div style="color: #ffffff; font-size: 28px; font-weight: 700; margin-top: 5px;">${ticket.generated_id}</div>
                            
                            <div style="margin-top: 12px;">
                                <span style="background-color: rgba(255,255,255,0.15); color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;">
                                    Agent: <strong>${this.escapeHtml(agentName)}</strong>
                                </span>
                            </div>
                        </td>
                        <td align="right" valign="top">
                            <span style="background-color: #ffffff; color: #1e293b; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; display: inline-block;">
                                ${this.escapeHtml(ticket.status)}
                            </span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Body -->
            <div style="padding: 30px;">
                <!-- Grid -->
                <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                    <tr>
                        <td width="50%" valign="top">
                            <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase;">Requester</div>
                            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px;">${this.escapeHtml(ticket.full_name)}</div>
                        </td>
                        <td width="50%" valign="top">
                            <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase;">Submitted</div>
                            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px;">${new Date(ticket.created).toLocaleString()}</div>
                        </td>
                    </tr>
                </table>

                <!-- Description -->
                <div style="margin-bottom: 25px;">
                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Description</div>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; color: #334155; font-size: 14px; line-height: 1.5;">
                        ${this.escapeHtml(ticket.description || 'No description provided')}
                    </div>
                </div>

                <!-- Attachment -->
                ${ticket.attachment_path ? `
                <div style="margin-bottom: 25px;">
                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Attachment</div>
                    <a href="${backendUrl}${ticket.attachment_path}" style="background-color: #eff6ff; color: #2563eb; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-block;">
                        View Attached File
                    </a>
                </div>` : ''}

                <!-- Remarks / Activity -->
                <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 25px;">
                    <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px;">
                         <div style="color: #1e40af; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            ℹ️ Latest Update from Support
                         </div>
                         <div style="color: #334155; font-size: 14px; line-height: 1.5;">
                            ${ticket.admin_remarks ? this.escapeHtml(ticket.admin_remarks) : 'No remarks yet.'}
                         </div>
                    </div>
                </div>

                <!-- Footer Action -->
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${frontendUrl}/track/${ticket.generated_id}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 100px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
                        Open Ticket Tracker
                    </a>
                </div>
            </div>
            
            <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px;">
                IT Support Notification System
            </div>
        </div>
      </div>
    `;
  }


  async sendTicketNotification(ticket: any) {
    const frontendUrl = await this.getFrontendUrl();
    const backendUrl = this.getBackendUrl();
    const teamEmails = await this.getTeamEmails();

    const cardContent = this.generateCardHtml(ticket, 'New Ticket Details', backendUrl, frontendUrl);

    // 1. Send to User
    await this.sendEmail(ticket.requester_email, `[Received] Ticket: ${ticket.generated_id}`, cardContent);

    // 2. Send to Team
    if (teamEmails.length > 0) {
      await this.sendEmail(teamEmails, `[New Ticket] ${ticket.generated_id} - ${ticket.department || 'General'}`, cardContent);
    }
  }


  async sendUpdateNotification(ticket: any) {
    const frontendUrl = await this.getFrontendUrl();
    const backendUrl = this.getBackendUrl();
    const teamEmails = await this.getTeamEmails();

    const cardContent = this.generateCardHtml(ticket, 'Ticket Status Update', backendUrl, frontendUrl);

    // 1. Send to User
    await this.sendEmail(ticket.requester_email, `[Update] ${ticket.generated_id}: ${ticket.status}`, cardContent);

    // 2. Send to Team
    if (teamEmails.length > 0) {
      await this.sendEmail(teamEmails, `[Notify] ${ticket.generated_id} Updated by ${ticket.resolved_by || 'Admin'}`, cardContent);
    }
  }

  async sendTestEmail(to: string) {
    const html = this.formatTemplate(
      '✅ Email Test Successful',
      `
      <p><strong>Congratulations!</strong> Your email system is working correctly.</p>
      <div class="detail-row"><div class="label">To:</div><div class="value">${this.escapeHtml(to)}</div></div>
      <div class="detail-row"><div class="label">Time:</div><div class="value">${new Date().toLocaleString()}</div></div>
      `
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

    // Group by Office
    const updatesByOffice: Record<string, any[]> = {};
    activeUpdates.forEach(u => {
      const office = u.item.office_location || 'Unknown';
      if (!updatesByOffice[office]) updatesByOffice[office] = [];
      updatesByOffice[office].push(u);
    });

    // Send Separate Emails per Office
    for (const [office, officeUpdates] of Object.entries(updatesByOffice)) {
      const rows = officeUpdates.map(u => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">${this.escapeHtml(u.item.item_name)}</td>
          <td style="padding: 8px; text-align: center;">${this.escapeHtml(u.item.office_location)}</td>
          <td style="padding: 8px; font-weight: bold; color: ${u.change > 0 ? 'green' : 'red'}; text-align: center;">
            ${u.change > 0 ? '+' : ''}${u.change}
          </td>
          <td style="padding: 8px; text-align: center;">${u.item.quantity}</td>
        </tr>
      `).join('');

      const html = this.formatTemplate(
        `📦 Stock Update: ${this.escapeHtml(office)}`,
        `
        <p>Inventory stock levels for <strong>${this.escapeHtml(office)}</strong> have been updated by <strong>${this.escapeHtml(performedBy)}</strong>.</p>
        
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
          <thead>
            <tr style="background: #f8f9fa; text-align: left;">
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 40%;">Item</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">Office</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">Change</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">New Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 20px;">
          <a href="${frontendUrl}/dashboard/inventory" class="btn">View Inventory</a>
        </div>
        `,
        '#0891b2'
      );

      await this.sendEmail(teamEmails, `[Inventory] Stock Updated by ${performedBy}, ${office}`, html);
    }
  }

  async sendLowStockAlert(items: any[]) {
    const frontendUrl = await this.getFrontendUrl();
    const teamEmails = await this.getTeamEmails();

    if (teamEmails.length === 0 || items.length === 0) return;

    const itemsByOffice: Record<string, any[]> = {};
    items.forEach(item => {
      const office = item.office_location || 'Unknown';
      if (!itemsByOffice[office]) itemsByOffice[office] = [];
      itemsByOffice[office].push(item);
    });

    for (const [office, officeItems] of Object.entries(itemsByOffice)) {
      const rows = officeItems.map(i => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;"><strong>${this.escapeHtml(i.item_name)}</strong></td>
          <td style="padding: 8px; text-align: center;">${this.escapeHtml(i.office_location)}</td>
          <td style="padding: 8px; color: red; font-weight: bold; text-align: center;">${i.quantity}</td>
          <td style="padding: 8px; color: #666; text-align: center;">${i.min_threshold}</td>
        </tr>
      `).join('');

      const itemNames = officeItems.map(i => i.item_name).join(', ');
      const subject = `[Alert] Low Stock Warning - ${office} - ${itemNames}`;

      const html = this.formatTemplate(
        `⚠️ Low Stock Alert: ${this.escapeHtml(office)}`,
        `
        <p>The following items are running low on stock and need attention:</p>
        
        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
          <thead>
            <tr style="background: #f8f9fa; text-align: left;">
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 40%;">Item</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">Location</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">Current Qty</th>
              <th style="padding: 8px; border-bottom: 2px solid #ddd; width: 20%; text-align: center;">Threshold</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 20px;">
          <a href="${frontendUrl}/dashboard/inventory" class="btn" style="background: #dc2626;">View Inventory</a>
        </div>

        <p style="font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
          Note: This alert is sent every 2 weeks for persistent low stock items.
        </p>
        `,
        '#dc2626'
      );

      await this.sendEmail(teamEmails, subject, html);
    }
  }

  async verifyConnection() {
    const transporter = await this.getTransporter();
    return transporter.verify();
  }
}

export default new EmailService();
