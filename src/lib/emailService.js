import axios from 'axios';

// Local Email Server URL (Relative path calls the same server hosting the app)
const API_URL = '/send-email';

/**
 * Sends an email using the local Node.js Email Server (Nodemailer).
 * Replaces the client-side EmailJS implementation for high-volume support.
 */
export const sendEmailNotification = async (config, params) => {
    // Destructure params
    const { to_email, subject, message, ticket_id, status, to_name } = params;

    // 1. Construct HTML Email Template
    const htmlContent = generateHtmlTemplate(params);

    // 2. Send via Local Server
    try {
        const response = await axios.post(API_URL, {
            to: to_email,
            subject: subject || `Notification: Ticket ${ticket_id}`,
            html: htmlContent,
            fromName: "IT Support Dashboard"
        });

        console.log("Email Sent via Local Server:", response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error("Email Service Failed:", error);
        // Fallback or Alert
        return { success: false, error: error.message };
    }
};

// --- Helper: HTML Generator ---
const generateHtmlTemplate = ({ to_name, ticket_id, message, office, ip, status }) => {
    // Extract Tracking URL if present in text
    const trackMatch = message.match(/Track: (http[^\s]+)/);
    const trackUrl = trackMatch ? trackMatch[1] : null;

    // Clean message of the raw URL for display
    let displayMessage = message.replace(/Track: http[^\s]+/, '').trim();

    // Contextual Colors
    const headerColor = status === 'Resolved' ? '#10b981' : '#2563eb'; // Green or Blue
    const title = status === 'Resolved' ? 'Ticket Resolved' : 'Ticket Update';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; }
            .header { background-color: ${headerColor}; padding: 30px 20px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px; }
            .info-box { background-color: #f3f4f6; border-left: 4px solid ${headerColor}; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
            .message-box { background-color: #fafafa; padding: 20px; border-radius: 8px; border: 1px dashed #d1d5db; margin: 20px 0; font-family: monospace; white-space: pre-wrap; }
            .btn { display: inline-block; background-color: ${headerColor}; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${title}</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Ticket #${ticket_id}</p>
            </div>
            <div class="content">
                <p>Hello <strong>${to_name || 'User'}</strong>,</p>
                
                ${status ? `
                <div class="info-box">
                    <strong>Current Status:</strong> ${status}
                </div>` : ''}

                <p>Here are the latest details regarding your request:</p>
                
                <div class="message-box">${displayMessage}</div>

                ${office ? `<p style="font-size: 13px; color: #666;"><strong>Office:</strong> ${office} ${ip ? `| <strong>IP:</strong> ${ip}` : ''}</p>` : ''}

                ${trackUrl ? `
                <div style="text-align: center;">
                    <a href="${trackUrl}" class="btn" style="color: white;">View Ticket Details</a>
                </div>` : ''}
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} IT Support System. <br/>
                This is an automated notification.
            </div>
        </div>
    </body>
    </html>
    `;
};
