// Resend email integration for BuildVision
import { Resend } from 'resend';

let connectionSettings: any;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
    isExistingUser?: boolean;
  }
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  
  const inviteUrl = `${baseUrl}/invite/${inviteData.inviteToken}`;
  
  const greeting = inviteData.clientName 
    ? `Hello ${inviteData.clientName},` 
    : 'Hello,';

  const ctaText = inviteData.isExistingUser ? 'Log In & Accept Invitation' : 'Accept Invitation & Create Account';
  const bodyText = inviteData.isExistingUser
    ? 'Click below to log in with your existing BuildVision account and accept this invitation.'
    : 'Click below to create your account and access your project dashboard.';

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
            <p style="margin: 0; color: #64748b;">${bodyText}</p>
          </div>
          
          <a href="${inviteUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            ${ctaText}
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

// Send signature completion notification to sender
export async function sendSignatureCompletedEmail(
  toEmail: string,
  completionData: {
    senderName: string;
    signerName: string;
    documentTitle: string;
    isFullyComplete: boolean;
    projectName?: string;
  }
) {
  const { client, fromEmail } = await getResendClient();
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  
  const subject = completionData.isFullyComplete
    ? `All signatures collected for "${completionData.documentTitle}"`
    : `${completionData.signerName} has signed "${completionData.documentTitle}"`;
  
  const statusMessage = completionData.isFullyComplete
    ? `<div style="background: #dcfce7; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0;">
        <p style="margin: 0; color: #166534; font-weight: 600;">
          ✅ All signatures have been collected! The document is now complete.
        </p>
      </div>`
    : `<div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
        <p style="margin: 0; color: #1e40af;">
          ${completionData.signerName} has signed the document. Other signatures may still be pending.
        </p>
      </div>`;

  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: toEmail,
    subject,
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
          <p style="color: #94a3b8; margin: 5px 0 0;">Document Signing Update</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Hello ${completionData.senderName},</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px; color: #1a1a2e; font-size: 20px;">📄 ${completionData.documentTitle}</h2>
            ${completionData.projectName ? `<p style="margin: 0; color: #64748b;">Project: ${completionData.projectName}</p>` : ''}
          </div>
          
          ${statusMessage}
          
          <a href="${baseUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            View in BuildVision
          </a>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send signature completion email:', error);
    throw new Error(`Failed to send signature completion email: ${error.message}`);
  }

  return data;
}

// Send demo request notification to the BuildVision team
export async function sendDemoRequestEmail(formData: {
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
}) {
  const { client, fromEmail } = await getResendClient();

  const teamEmail = process.env.CONTACT_TEAM_EMAIL || 'hello@buildvision.io';
  const safeName = escapeHtml(formData.name);
  const safeCompany = escapeHtml(formData.company);
  const safeEmail = escapeHtml(formData.email);
  const safePhone = escapeHtml(formData.phone);
  const safeMessage = escapeHtml(formData.message).replace(/\n/g, '<br>');
  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: teamEmail,
    replyTo: formData.email,
    subject: `Demo Request from ${formData.name}${formData.company ? ` — ${formData.company}` : ''}`,
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
          <p style="color: #94a3b8; margin: 5px 0 0;">New Demo Request</p>
        </div>

        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <div style="background: #eff6ff; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 15px; color: #1e40af; font-weight: 600;">A prospect has requested a demo through the BuildVision website.</p>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 130px; color: #64748b; font-size: 14px; font-weight: 600;">Name</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px;">${safeName}</td>
            </tr>
            ${safeCompany ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; font-weight: 600;">Company</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px;">${safeCompany}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; font-weight: 600;">Email</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px;"><a href="mailto:${safeEmail}" style="color: #3b82f6;">${safeEmail}</a></td>
            </tr>
            ${safePhone ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; font-weight: 600;">Phone</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 15px;">${safePhone}</td>
            </tr>` : ''}
            ${safeMessage ? `
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; vertical-align: top;">Message</td>
              <td style="padding: 10px 0; font-size: 15px;">${safeMessage}</td>
            </tr>` : ''}
          </table>

          <div style="margin-top: 24px;">
            <a href="mailto:${safeEmail}?subject=Re: BuildVision Demo Request" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Reply to ${safeName}
            </a>
          </div>
        </div>

        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Submitted via BuildVision demo request form &bull; ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} ET</p>
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send demo request email:', error);
    throw new Error(`Failed to send demo request email: ${error.message}`);
  }

  return data;
}

// Send password reset email
export async function sendPasswordResetEmail(
  toEmail: string,
  resetData: {
    userName?: string;
    resetToken: string;
  }
) {
  const { client, fromEmail } = await getResendClient();

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS?.split(',')[0]
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';

  const resetUrl = `${baseUrl}/reset-password/${resetData.resetToken}`;
  const greeting = resetData.userName ? `Hi ${escapeHtml(resetData.userName)},` : 'Hi there,';

  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: toEmail,
    subject: 'Reset your BuildVision password',
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
          <p style="color: #94a3b8; margin: 5px 0 0;">Password Reset Request</p>
        </div>

        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">${greeting}</p>

          <p>We received a request to reset the password for your BuildVision account. Click the button below to choose a new password.</p>

          <div style="background: #fef9c3; padding: 15px; border-radius: 8px; border-left: 4px solid #eab308; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #854d0e;">
              <strong>This link expires in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email — your account is not at risk.
            </p>
          </div>

          <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            Reset My Password
          </a>

          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  return data;
}

// Send external sub/notary project invite email
export async function sendExternalInviteEmail(
  toEmail: string,
  inviteData: {
    inviterName: string;
    projectName: string;
    role: 'subcontractor' | 'notary';
    loginUrl: string;
    isNewUser: boolean;
    registerUrl?: string;
    inviteeName?: string;
  }
) {
  const { client, fromEmail } = await getResendClient();

  const roleLabel = inviteData.role === 'notary' ? 'Notary' : 'Sub-Contractor';
  const actionUrl = inviteData.isNewUser ? (inviteData.registerUrl || inviteData.loginUrl) : inviteData.loginUrl;
  const actionLabel = inviteData.isNewUser ? 'Create Account & Get Started' : 'Log In to View Project';
  const greeting = inviteData.inviteeName ? `Hi ${inviteData.inviteeName},` : 'Hi there,';
  const newUserNote = inviteData.isNewUser
    ? `<p style="color: #64748b; font-size: 14px; margin-top: 20px;">You don't have a BuildVision account yet. Click the button above to create a free account and access the project.</p>`
    : '';

  const { data, error } = await client.emails.send({
    from: fromEmail || 'BuildVision <onboarding@resend.dev>',
    to: toEmail,
    subject: `You've been invited to a project on BuildVision as a ${roleLabel}`,
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
          <p style="color: #94a3b8; margin: 5px 0 0;">Construction Management Platform</p>
        </div>

        <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">${greeting}</p>

          <p><strong>${inviteData.inviterName}</strong> has invited you to collaborate on <strong>${inviteData.projectName}</strong> as a <strong>${roleLabel}</strong>.</p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 15px;">📋 <strong>Project:</strong> ${inviteData.projectName}</p>
            <p style="margin: 8px 0 0; font-size: 15px;">👤 <strong>Your Role:</strong> ${roleLabel}</p>
          </div>

          <a href="${actionUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 0;">
            ${actionLabel}
          </a>

          ${newUserNote}

          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
            Or copy and paste this link into your browser:<br>
            <a href="${actionUrl}" style="color: #3b82f6; word-break: break-all;">${actionUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="margin: 0; font-size: 13px; color: #64748b;">
            If you were not expecting this invitation, you can safely ignore this email.
          </p>
        </div>

        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} BuildVision. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Failed to send external invite email:', error);
    throw new Error(`Failed to send external invite email: ${error.message}`);
  }

  return data;
}
