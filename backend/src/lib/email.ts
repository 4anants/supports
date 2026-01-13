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

    // Outlook-Compatible Table Layout
    return `
      <!DOCTYPE html>
      <html>
      <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <style>
        :root { color-scheme: light; }
        body { margin: 0; padding: 0; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        a { text-decoration: none; }
      </style>
      </head>
      <body style="background-color: #f3f4f6; margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
          <tr>
            <td align="center">
              <!-- Card Container -->
              <table width="500" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; width: 500px; max-width: 500px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <!-- Fallback color #1e40af (Darker Blue) for Outlook -->
                  <td style="background-color: #1e40af; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); padding: 30px; text-align: left;">
                      <div style="color: #bfdbfe; font-size: 11px; font-weight: bold; text-transform: uppercase; font-family: sans-serif; letter-spacing: 1px;">${titleSub}</div>
                      <div style="color: #ffffff; font-size: 24px; font-weight: bold; margin-top: 5px; font-family: sans-serif;">${this.escapeHtml(ticket.generated_id)}</div>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;">
                          <tr>
                              <td style="color: #ffffff; font-family: sans-serif; font-size: 13px;">
                                  Agent: <strong>${this.escapeHtml(agentName)}</strong>
                              </td>
                              <td align="right">
                                  <span style="background-color: #ffffff; color: #1e293b; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; font-family: sans-serif; display: inline-block;">
                                      ${this.escapeHtml(ticket.status)}
                                  </span>
                              </td>
                          </tr>
                      </table>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 30px; background-color: #ffffff;">
                     
                     <!-- Grid -->
                     <table width="100%" cellpadding="0" cellspacing="0" border="0">
                       <tr>
                          <td width="50%" valign="top" style="padding-bottom: 20px;">
                              <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">Requester</div>
                              <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${this.escapeHtml(ticket.full_name)}</div>
                          </td>
                          <td width="50%" valign="top" style="padding-bottom: 20px;">
                              <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">Submitted</div>
                              <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${new Date(ticket.created).toLocaleDateString()}</div>
                          </td>
                       </tr>
                       <tr>
                          <td width="50%" valign="top" style="padding-bottom: 20px;">
                              <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">Hostname</div>
                              <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${this.escapeHtml(ticket.computer_name || '-')}</div>
                          </td>
                          <td width="50%" valign="top" style="padding-bottom: 20px;">
                              <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">IP Address</div>
                              <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${this.escapeHtml(ticket.ip_address || '-')}</div>
                          </td>
                       </tr>
                       ${isResolved ? `
                       <tr>
                           <td width="50%" valign="top" style="padding-bottom: 20px;">
                               <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">Resolved</div>
                               <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${new Date(ticket.resolved_at).toLocaleDateString()}</div>
                           </td>
                           <td width="50%" valign="top" style="padding-bottom: 20px;">
                               <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">Duration</div>
                               <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-top: 4px; font-family: sans-serif;">${duration}</div>
                           </td>
                       </tr>
                       ` : ''}
                     </table>
                     
                     <!-- Description -->
                     <div style="color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; font-family: sans-serif; margin-bottom: 6px;">Description</div>
                     <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; color: #334155; font-size: 14px; line-height: 1.5; font-family: sans-serif;">
                        ${this.escapeHtml(ticket.description || 'No description provided')}
                     </div>
  
                     <!-- Attachment -->
                     ${ticket.attachment_path ? `
                     <div style="margin-top: 20px;">
                          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #eff6ff; border-radius: 6px; padding: 8px 16px;">
                              <a href="${backendUrl}${ticket.attachment_path}" style="color: #2563eb; font-size: 13px; font-weight: 600; text-decoration: none; font-family: sans-serif; display: block;">View Attached File</a>
                          </td></tr></table>
                     </div>` : ''}
  
                     <!-- Remarks -->
                     <div style="margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 15px;">
                            <div style="color: #1e40af; font-size: 13px; font-weight: bold; margin-bottom: 5px; font-family: sans-serif;">ℹ️ Updated By ${this.escapeHtml(agentName)}</div>
                            <div style="color: #334155; font-size: 14px; font-family: sans-serif;">${ticket.admin_remarks ? this.escapeHtml(ticket.admin_remarks) : 'No remarks yet.'}</div>
                        </div>
                     </div>
  
                     <!-- CTA -->
                     <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px;">
                          <tr>
                              <td align="center">
                                  <table cellpadding="0" cellspacing="0" border="0">
                                      <tr>
                                          <td style="background-color: #0f172a; border-radius: 50px; padding: 12px 28px;">
                                              <a href="${actionUrl}" style="color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; font-family: sans-serif; display: inline-block;">${actionText}</a>
                                          </td>
                                      </tr>
                                      ${secondaryActionUrl ? `
                                      <tr>
                                          <td style="padding-top: 15px; text-align: center;">
                                              <a href="${secondaryActionUrl}" style="color: #64748b; font-size: 13px; font-weight: 600; text-decoration: none; font-family: sans-serif; display: inline-block; border-bottom: 1px dashed #cbd5e1;">${secondaryActionText}</a>
                                          </td>
                                      </tr>
                                      ` : ''}
                                  </table>
                              </td>
                          </tr>
                     </table>
  
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <div style="margin-top: 20px; color: #94a3b8; font-size: 11px; font-family: sans-serif;">IT Support Notification System</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
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

    // Separate Refills (Positive) and Issues (Negative)
    const refills = activeUpdates.filter(u => u.change > 0);

    // SEND REFILL NOTIFICATION
    if (refills.length > 0) {
      const rows = refills.map(u => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px;">${this.escapeHtml(u.item.item_name)}</td>
            <td style="padding: 8px; text-align: center;">${this.escapeHtml(u.item.office_location)}</td>
            <td style="padding: 8px; font-weight: bold; color: green; text-align: center;">+${u.change}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">${u.item.quantity}</td>
          </tr>
        `).join('');

      const html = this.formatTemplate(
        `📦 Stock Refill Alert`,
        `
          <p>The following items have been <strong>restocked</strong> by <strong>${this.escapeHtml(performedBy)}</strong>.</p>
          
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
            <thead>
              <tr style="background: #f0fdf4; text-align: left;">
                <th style="padding: 8px; border-bottom: 2px solid #bbf7d0; width: 40%;">Item</th>
                <th style="padding: 8px; border-bottom: 2px solid #bbf7d0; width: 20%; text-align: center;">Location</th>
                <th style="padding: 8px; border-bottom: 2px solid #bbf7d0; width: 20%; text-align: center;">Added</th>
                <th style="padding: 8px; border-bottom: 2px solid #bbf7d0; width: 20%; text-align: center;">New Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="margin-top: 20px;">
            <a href="${frontendUrl}/dashboard/inventory" class="btn" style="background: #16a34a;">View Inventory</a>
          </div>
          `,
        '#16a34a'
      );

      await this.sendEmail(teamEmails, `[Stock Refill] ${refills.length} Items Updated by ${performedBy}`, html);
    }
  }

  async sendLowStockAlert(items: any[]) {
    const frontendUrl = await this.getFrontendUrl();
    const teamEmails = await this.getTeamEmails();

    if (teamEmails.length === 0 || items.length === 0) return;

    // Consolidate ALL items into ONE Single Email
    const rows = items.map(i => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;"><strong>${this.escapeHtml(i.item_name)}</strong></td>
        <td style="padding: 8px; text-align: center;">${this.escapeHtml(i.office_location)}</td>
        <td style="padding: 8px; color: red; font-weight: bold; text-align: center;">${i.quantity}</td>
        <td style="padding: 8px; color: #666; text-align: center;">${i.min_threshold}</td>
      </tr>
    `).join('');

    const html = this.formatTemplate(
      `⚠️ Weekly Low Stock Report`,
      `
      <p>This is your weekly summary of items that are running low on stock.</p>
      
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
        <thead>
          <tr style="background: #fef2f2; text-align: left;">
            <th style="padding: 8px; border-bottom: 2px solid #fecaca; width: 40%;">Item</th>
            <th style="padding: 8px; border-bottom: 2px solid #fecaca; width: 20%; text-align: center;">Location</th>
            <th style="padding: 8px; border-bottom: 2px solid #fecaca; width: 20%; text-align: center;">Current</th>
            <th style="padding: 8px; border-bottom: 2px solid #fecaca; width: 20%; text-align: center;">Min Limit</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top: 20px;">
        <a href="${frontendUrl}/dashboard/inventory" class="btn" style="background: #dc2626;">Manage Inventory</a>
      </div>

      <p style="font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
        Generated automatically every Monday at 09:00 AM.
      </p>
      `,
      '#dc2626'
    );

    await this.sendEmail(teamEmails, `[Alert] Weekly Low Stock Report (${items.length} Items)`, html);
  }

  async verifyConnection() {
    const transporter = await this.getTransporter();
    return transporter.verify();
  }
}

export default new EmailService();
