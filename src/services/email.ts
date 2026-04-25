/**
 * @fileoverview Email service for Ridesk Server
 * @description Handles email sending using Loop.so API with Nodemailer/SMTP as fallback
 * @author Ridesk Team
 * @version 2.0.0
 */

import nodemailer from "nodemailer";
import { LoopsClient } from "loops";
import { env } from "../config/env";

// Initialize Loop client (if API key is available)
let loopsClient: LoopsClient | null = null;
if (env.LOOPS_API_KEY) {
  try {
    loopsClient = new LoopsClient(env.LOOPS_API_KEY);
    console.log("✅ Loop email client initialized");
  } catch (error) {
    console.warn("⚠️  Failed to initialize Loop client:", error);
  }
}

// Helper function to format date for email templates
const formatDateForEmail = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.warn("Failed to format date:", error);
    return dateString;
  }
};

// Email transporter configuration
const createTransporter = () => {
  const config: any = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };

  if (env.SMTP_PORT === 587) {
    config.requireTLS = true;
    config.tls = {
      rejectUnauthorized: true, 
    };
  }

  return nodemailer.createTransport(config);
};

// Email templates
export const emailTemplates = {
  userInvitation: (data: {
    firstName: string;
    lastName: string;
    schoolName: string;
    role: string;
    invitationUrl: string;
    expiresAt: string;
  }) => {
    const { firstName, lastName, schoolName, role, invitationUrl, expiresAt } = data;
    
    return {
      subject: `You're invited to join ${schoolName} on Ridesk`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Ridesk</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #ec4899;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #6b7280;
            }
            .content {
              margin-bottom: 30px;
            }
            .invitation-details {
              background: #f3f4f6;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            .detail-label {
              font-weight: 600;
              color: #374151;
            }
            .detail-value {
              color: #6b7280;
            }
            .cta-button {
              display: inline-block;
              background: #ec4899;
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .cta-button:hover {
              background: #db2777;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .expiry-notice {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Ridesk</div>
              <h1 class="title">You're Invited!</h1>
              <p class="subtitle">Join ${schoolName} on our watersports management platform</p>
            </div>
            
            <div class="content">
              <p>Hello ${firstName} ${lastName},</p>
              
              <p>You've been invited to join <strong>${schoolName}</strong> on Ridesk as a <strong>${role.toLowerCase()}</strong>.</p>
              
              <div class="invitation-details">
                <div class="detail-row">
                  <span class="detail-label">School:</span>
                  <span class="detail-value">${schoolName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Role:</span>
                  <span class="detail-value">${role}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Expires:</span>
                  <span class="detail-value">${new Date(expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <p>Click the button below to accept your invitation and create your account:</p>
              
              <div style="text-align: center;">
                <a href="${invitationUrl}" class="cta-button">Accept Invitation</a>
              </div>
              
              <div class="expiry-notice">
                <strong>⏰ Important:</strong> This invitation expires on ${new Date(expiresAt).toLocaleDateString()}. Please accept it soon to secure your spot.
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${invitationUrl}</p>
            </div>
            
            <div class="footer">
              <p>This invitation was sent by ${schoolName} through Ridesk.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        You're invited to join ${schoolName} on Ridesk!
        
        Hello ${firstName} ${lastName},
        
        You've been invited to join ${schoolName} on Ridesk as a ${role.toLowerCase()}.
        
        School: ${schoolName}
        Role: ${role}
        Expires: ${new Date(expiresAt).toLocaleDateString()}
        
        Click this link to accept your invitation:
        ${invitationUrl}
        
        This invitation expires on ${new Date(expiresAt).toLocaleDateString()}. Please accept it soon to secure your spot.
        
        If you didn't expect this invitation, you can safely ignore this email.
        
        Best regards,
        The Ridesk Team
      `,
    };
  },

  passwordResetOTP: (data: { otp: string }) => {
    const { otp } = data;

    return {
      subject: "Your Ridesk Password Reset Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Ridesk</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #ec4899;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #6b7280;
            }
            .content {
              margin-bottom: 30px;
            }
            .otp-box {
              background: #f3f4f6;
              border: 2px dashed #ec4899;
              border-radius: 8px;
              padding: 30px;
              margin: 30px 0;
              text-align: center;
            }
            .otp-code {
              font-size: 28px;
              font-weight: bold;
              color: #ec4899;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .otp-label {
              font-size: 14px;
              color: #6b7280;
              margin-top: 10px;
            }
            .warning {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Ridesk</div>
              <h1 class="title">Password Reset</h1>
              <p class="subtitle">Use the code below to reset your password</p>
            </div>
            
            <div class="content">
              <p>Hello,</p>
              
              <p>You requested to reset your password for your Ridesk account. Use the verification code below to complete the process:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
                <div class="otp-label">Verification Code</div>
              </div>
              
              <p>
                 This code will expire in 10 minutes. If you didn't request a password reset, please ignore this email.
              </p>
              
              
            
            <div class="footer">
              <p>This email was sent by Ridesk.</p>
              <p>If you didn't request this password reset, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset - Ridesk
        
        Hello,
        
        You requested to reset your password for your Ridesk account. Use the verification code below to complete the process:
        
        Verification Code: ${otp}
        
        This code will expire in 10 minutes. If you didn't request a password reset, please ignore this email.
        
        Enter this code on the password reset page along with your new password to complete the reset process.
        
        If you didn't request this password reset, you can safely ignore this email.
        
        Best regards,
        The Ridesk Team
      `,
    };
  },

  studentInformationForm: (data: {
    firstName: string;
    lastName: string;
    schoolName: string;
    formUrl: string;
    expiresAt: string;
  }) => {
    const { firstName, lastName, schoolName, formUrl, expiresAt } = data;
    
    return {
      subject: `Complete Your Student Information - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Student Information - Ridesk</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9fafb;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #ec4899;
              margin-bottom: 10px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 16px;
              color: #6b7280;
            }
            .content {
              margin-bottom: 30px;
            }
            .cta-button {
              display: inline-block;
              background: #ec4899;
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
              margin: 20px 0;
            }
            .cta-button:hover {
              background: #db2777;
            }
            .info-box {
              background: #f3f4f6;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .warning {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Ridesk</div>
              <h1 class="title">Complete Your Information</h1>
              <p class="subtitle">${schoolName} needs your student details</p>
            </div>
            
            <div class="content">
              <p>Hello ${firstName} ${lastName},</p>
              
              <p>You've been registered as a student at <strong>${schoolName}</strong> on Ridesk. To complete your registration, please fill out the student information form with any missing details.</p>
              
              <div class="info-box">
                <p><strong>What you need to do:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Click the button below to access your student information form</li>
                  <li>Review and complete any missing information</li>
                  <li>Submit the form (you can only submit it once)</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${formUrl}" class="cta-button">Complete Student Information</a>
              </div>
              
              <div class="warning">
                <strong>⏰ Important:</strong> This form link expires on ${new Date(expiresAt).toLocaleDateString()}. Please complete it soon to ensure your information is up to date.
              </div>
              
              <p><strong>Note:</strong> You can only submit this form once. Please review all information carefully before submitting.</p>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${formUrl}</p>
            </div>
            
            <div class="footer">
              <p>This email was sent by ${schoolName} through Ridesk.</p>
              <p>If you didn't expect this email, you can safely ignore it.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Complete Your Student Information - ${schoolName}
        
        Hello ${firstName} ${lastName},
        
        You've been registered as a student at ${schoolName} on Ridesk. To complete your registration, please fill out the student information form with any missing details.
        
        What you need to do:
        - Click the link below to access your student information form
        - Review and complete any missing information
        - Submit the form (you can only submit it once)
        
        Complete your form here: ${formUrl}
        
        Important: This form link expires on ${new Date(expiresAt).toLocaleDateString()}. Please complete it soon to ensure your information is up to date.
        
        Note: You can only submit this form once. Please review all information carefully before submitting.
        
        If you didn't expect this email, you can safely ignore it.
        
        Best regards,
        ${schoolName} - Ridesk
      `,
    };
  },
};

const verifyAndLogSmtpConnection = async (
  transporter: nodemailer.Transporter,
  emailType: string,
): Promise<void> => {
  await transporter.verify();
  console.log(`SMTP connection verified for ${emailType}`);
};


const handleSmtpError = (error: any, context: string): never => {
  if (error?.code === "EAUTH") {
    throw new Error(
      "SMTP authentication failed. Check your SMTP_USER and SMTP_PASS. Make sure you're using a Gmail App Password, not your regular password.",
    );
  } else if (error?.code === "ECONNECTION") {
    throw new Error(
      `Cannot connect to SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}. Check your network and firewall settings.`,
    );
  } else if (error?.code === "ETIMEDOUT") {
    throw new Error(
      "SMTP connection timeout. Check your network and SMTP settings.",
    );
  }

  throw new Error(
    `Failed to send ${context}: ${error?.message || "Unknown error"}`,
  );
};

// Email service functions
export const emailService = {
  /**
   * Send user invitation email
   */
  async sendUserInvitation(data: {
    to: string;
    firstName: string;
    lastName: string;
    schoolName: string;
    role: string;
    invitationToken: string;
    expiresAt: string;
    baseUrl: string;
  }): Promise<void> {
    const { to, firstName, lastName, schoolName, role, invitationToken, expiresAt, baseUrl } = data;
    
    const invitationUrl = `${baseUrl}/invitation?token=${invitationToken}`;
    const expiresAtFormatted = formatDateForEmail(expiresAt);

    // Try Loop first if configured
    if (loopsClient && env.LOOPS_TRANSACTIONAL_ID_USER_INVITATION) {
      try {
        console.log(`Sending user invitation email via Loop to ${to}...`);
        await loopsClient.sendTransactionalEmail({
          transactionalId: env.LOOPS_TRANSACTIONAL_ID_USER_INVITATION,
          email: to,
          dataVariables: {
            firstName,
            lastName,
            schoolName,
            role,
            invitationUrl,
            expiresAt,
            expiresAtFormatted,
          },
        });
        console.log(`✅ User invitation email sent via Loop to ${to}`);
        return;
      } catch (error: any) {
        console.warn(`⚠️  Loop email failed, falling back to SMTP:`, error?.message || error);
        // Fall through to SMTP fallback
      }
    }

    // Fallback to SMTP/Nodemailer
    if (!env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM_EMAIL) {
      console.warn("Email service not configured. Skipping email send.");
      return;
    }

    const template = emailTemplates.userInvitation({
      firstName,
      lastName,
      schoolName,
      role,
      invitationUrl,
      expiresAt,
    });

    const transporter = createTransporter();

    try {
      await verifyAndLogSmtpConnection(transporter, "user invitation email");

      console.log(`Sending invitation email via SMTP to ${to}...`);
      await transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      console.log(`✅ User invitation email sent via SMTP to ${to}`);
    } catch (error: any) {
      handleSmtpError(error, "invitation email");
    }
  },

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(to: string, otp: string): Promise<void> {
    // Try Loop first if configured
    if (loopsClient && env.LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET) {
      try {
        console.log(`Sending password reset OTP email via Loop to ${to}...`);
        await loopsClient.sendTransactionalEmail({
          transactionalId: env.LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET,
          email: to,
          dataVariables: {
            otp,
          },
        });
        console.log(`✅ Password reset OTP email sent via Loop to ${to}`);
        return;
      } catch (error: any) {
        console.warn(`⚠️  Loop email failed, falling back to SMTP:`, error?.message || error);
        // Fall through to SMTP fallback
      }
    }

    // Fallback to SMTP/Nodemailer
    console.log("Checking SMTP configuration...");
    console.log(`SMTP_HOST: ${env.SMTP_HOST}`);
    console.log(`SMTP_PORT: ${env.SMTP_PORT}`);
    console.log(`SMTP_USER: ${env.SMTP_USER ? "Set" : "Missing"}`);
    console.log(`SMTP_PASS: ${env.SMTP_PASS ? "Set" : "Missing"}`);
    console.log(`SMTP_FROM_EMAIL: ${env.SMTP_FROM_EMAIL || "Missing"}`);
    
    if (!env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM_EMAIL) {
      const missing = [];
      if (!env.SMTP_USER) missing.push("SMTP_USER");
      if (!env.SMTP_PASS) missing.push("SMTP_PASS");
      if (!env.SMTP_FROM_EMAIL) missing.push("SMTP_FROM_EMAIL");
      console.error(`❌ Email service not configured. Missing: ${missing.join(", ")}`);
      throw new Error(`Email service not configured. Missing: ${missing.join(", ")}`);
    }

    const template = emailTemplates.passwordResetOTP({ otp });
    console.log(`Creating email transporter for ${to}...`);

    const transporter = createTransporter();

    try {
      // Verify connection first
      console.log("Verifying SMTP connection...");
      await transporter.verify();
      console.log("✅ SMTP connection verified");

      console.log(`Sending password reset email via SMTP to ${to}...`);
      const result = await transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`✅ Password reset OTP email sent successfully via SMTP to ${to}`);
      console.log(`Message ID: ${result.messageId}`);
    } catch (error: any) {
      console.error("❌ Failed to send password reset OTP email:");
      console.error("Error type:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error response:", error?.response);
      console.error("Full error:", error);
      
      // Provide more specific error messages
      if (error?.code === "EAUTH") {
        throw new Error("SMTP authentication failed. Check your SMTP_USER and SMTP_PASS.");
      } else if (error?.code === "ECONNECTION") {
        throw new Error(`Cannot connect to SMTP server ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      } else if (error?.code === "ETIMEDOUT") {
        throw new Error("SMTP connection timeout. Check your network and SMTP settings.");
      }
      
      throw new Error(`Failed to send password reset OTP email: ${error?.message || "Unknown error"}`);
    }
  },

  async sendStudentFormEmail(data: {
    to: string;
    firstName: string;
    lastName: string;
    schoolName: string;
    invitationToken: string;
    expiresAt: string;
    baseUrl: string;
  }): Promise<void> {
    const { to, firstName, lastName, schoolName, invitationToken, expiresAt, baseUrl } = data;
    
    const formUrl = `${baseUrl}/student-form?token=${invitationToken}`;
    const expiresAtFormatted = formatDateForEmail(expiresAt);

    // Try Loop first if configured
    if (loopsClient && env.LOOPS_TRANSACTIONAL_ID_STUDENT_FORM) {
      try {
        console.log(`Sending student form email via Loop to ${to}...`);
        await loopsClient.sendTransactionalEmail({
          transactionalId: env.LOOPS_TRANSACTIONAL_ID_STUDENT_FORM,
          email: to,
          dataVariables: {
            firstName,
            lastName,
            schoolName,
            formUrl,
            expiresAt,
            expiresAtFormatted,
          },
        });
        console.log(`✅ Student form email sent via Loop to ${to}`);
        return;
      } catch (error: any) {
        console.warn(`⚠️  Loop email failed, falling back to SMTP:`, error?.message || error);
        // Fall through to SMTP fallback
      }
    }

    // Fallback to SMTP/Nodemailer
    if (!env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM_EMAIL) {
      const missing = [];
      if (!env.SMTP_USER) missing.push("SMTP_USER");
      if (!env.SMTP_PASS) missing.push("SMTP_PASS");
      if (!env.SMTP_FROM_EMAIL) missing.push("SMTP_FROM_EMAIL");
      throw new Error(`Email service not configured. Missing: ${missing.join(", ")}`);
    }

    const template = emailTemplates.studentInformationForm({
      firstName,
      lastName,
      schoolName,
      formUrl,
      expiresAt,
    });

    const transporter = createTransporter();

    try {
      await verifyAndLogSmtpConnection(transporter, "student form email");
      console.log(`Sending student form email via SMTP to ${to}...`);
      await transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      console.log(`✅ Student form email sent via SMTP to ${to}`);
    } catch (error: any) {
      handleSmtpError(error, "student form email");
    }
  },

  /**
   * Test email configuration
   * Tests both Loop API and SMTP connection
   */
  async testConnection(): Promise<boolean> {
    let loopConfigured = false;
    let smtpConfigured = false;

    // Test Loop configuration
    if (env.LOOPS_API_KEY && loopsClient) {
      try {
        // Try to make a simple API call to verify the key works
        // Note: Loop doesn't have a direct "test" endpoint, but we can check if client is initialized
        if (env.LOOPS_TRANSACTIONAL_ID_USER_INVITATION || 
            env.LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET || 
            env.LOOPS_TRANSACTIONAL_ID_STUDENT_FORM) {
          loopConfigured = true;
          console.log("✅ Loop API key is configured");
        } else {
          console.warn("⚠️  Loop API key is set but no transactional IDs are configured");
        }
      } catch (error) {
        console.warn("⚠️  Loop API test failed:", error);
      }
    } else {
      console.log("ℹ️  Loop API key not configured");
    }

    // Test SMTP configuration
    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        const transporter = createTransporter();
        await transporter.verify();
        smtpConfigured = true;
        console.log("✅ SMTP connection verified");
      } catch (error) {
        console.warn("⚠️  SMTP connection test failed:", error);
      }
    } else {
      console.log("ℹ️  SMTP credentials not configured");
    }

    // Return true if at least one email service is configured
    return loopConfigured || smtpConfigured;
  },
};

export default emailService;
