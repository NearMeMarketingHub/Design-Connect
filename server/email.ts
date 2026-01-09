// Resend email integration for BuildVision
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

// Get fresh Resend client (never cache - tokens expire)
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Send project invite email
export async function sendProjectInviteEmail(
  toEmail: string,
  inviteData: {
    projectName: string;
    contractorName: string;
    inviteToken: string;
    clientName?: string;
  }
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  
  const inviteUrl = `${baseUrl}/accept-invite/${inviteData.inviteToken}`;
  
  const greeting = inviteData.clientName 
    ? `Hello ${inviteData.clientName},` 
    : 'Hello,';

  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: toEmail,
    subject: `You've been invited to ${inviteData.projectName} on BuildVision`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">BuildVision</h1>
          <p style="color: #94a3b8; margin: 5px 0 0;">Construction Project Management</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">${greeting}</p>
          
          <p><strong>${inviteData.contractorName}</strong> has invited you to collaborate on a construction project:</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px; color: #1a1a2e; font-size: 20px;">${inviteData.projectName}</h2>
            <p style="margin: 0; color: #64748b;">Click below to create your account and access your project dashboard.</p>
          </div>
          
          <a href="${inviteUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            Accept Invitation
          </a>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>This invitation will expire in 7 days.</p>
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send invite email:', error);
    throw new Error(`Failed to send invite email: ${error.message}`);
  }

  return data;
}

// Send signature request email
export async function sendSignatureRequestEmail(
  toEmail: string,
  signingData: {
    recipientName: string;
    documentTitle: string;
    senderName: string;
    message?: string;
    accessToken: string;
    dueDate?: Date | null;
  }
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  
  const signingUrl = `${baseUrl}/sign/${signingData.accessToken}`;
  
  const dueDateText = signingData.dueDate 
    ? `<p style="color: #dc2626; margin: 10px 0;"><strong>Due Date:</strong> ${new Date(signingData.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : '';

  const messageSection = signingData.message
    ? `<div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af; font-style: italic;">"${signingData.message}"</p>
        <p style="margin: 5px 0 0; color: #64748b; font-size: 12px;">— ${signingData.senderName}</p>
      </div>`
    : '';

  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: toEmail,
    subject: `Action Required: Please sign "${signingData.documentTitle}"`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">BuildVision</h1>
          <p style="color: #94a3b8; margin: 5px 0 0;">Electronic Document Signing</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Hello ${signingData.recipientName},</p>
          
          <p><strong>${signingData.senderName}</strong> has sent you a document that requires your signature:</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px; color: #1a1a2e; font-size: 20px;">📄 ${signingData.documentTitle}</h2>
            ${dueDateText}
          </div>
          
          ${messageSection}
          
          <a href="${signingUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            Review & Sign Document
          </a>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${signingUrl}" style="color: #3b82f6; word-break: break-all;">${signingUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <div style="background: #fefce8; padding: 15px; border-radius: 8px; border-left: 4px solid #eab308;">
            <p style="margin: 0; font-size: 13px; color: #854d0e;">
              <strong>🔐 Secure Signing</strong><br>
              Your signature is legally binding under the ESIGN Act and UETA. All signing activity is logged for audit purposes.
            </p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
          <p>If you did not expect this request, please ignore this email.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send signature request email:', error);
    throw new Error(`Failed to send signature request email: ${error.message}`);
  }

  return data;
}
