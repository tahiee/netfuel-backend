import axios from "axios";
import { env } from "@/utils/env.util";
import { logger } from "@/utils/logger.util";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlContent: string;
}

export const sendEmail = async ({
  to,
  subject,
  htmlContent,
}: SendEmailParams): Promise<void> => {
  if (!env.SENDGRID_API_KEY) {
    logger.warn("SENDGRID_API_KEY not set — skipping email send");
    return;
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [{ to: recipients }],
        from: { email: env.SENDGRID_SENDER, name: "Netfuel" },
        subject,
        content: [{ type: "text/html", value: htmlContent }],
      },
      {
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    logger.error("Failed to send email:", {
      subject,
      to: recipients.map((r) => r.email),
      status: error?.response?.status,
      body: error?.response?.data,
    });
    throw error;
  }
};

// ── Templates ────────────────────────────────────────────────────────────────

const baseStyle = `font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px`;
const accent = "#6366f1";
const btnStyle = `background:${accent};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px`;
const footer = `<p style="color:#999;font-size:12px;margin-top:24px">Netfuel &bull; AI-Powered Brand Monitoring</p>`;

export const otpTemplate = (
  otp: string,
  title: string,
  subtitle: string
): string => `
<div style="${baseStyle}">
  <h1 style="color:#111;font-size:22px;margin-bottom:4px">${title}</h1>
  <p style="color:#555;margin-bottom:24px">${subtitle}</p>
  <div style="background:#f5f5f5;border-radius:8px;padding:28px;text-align:center">
    <p style="color:#333;margin-bottom:12px">Your verification code:</p>
    <div style="background:#fff;border:2px dashed ${accent};border-radius:8px;padding:16px;display:inline-block">
      <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:${accent};font-family:monospace">${otp}</span>
    </div>
    <p style="color:#888;font-size:13px;margin-top:12px">Expires in 10 minutes.</p>
  </div>
  <p style="color:#999;font-size:12px;margin-top:24px">
    If you didn't request this code, ignore this email.
  </p>
  ${footer}
</div>
`;

export const forgotPasswordTemplate = ({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}): string => `
<div style="${baseStyle}">
  <h1 style="color:#111;font-size:22px">Reset your password</h1>
  <p style="color:#555">Hi ${user.name},</p>
  <p style="color:#555">
    We received a request to reset the password for your Netfuel account
    (<strong>${user.email}</strong>). Click below to choose a new password.
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${url}" style="${btnStyle}">Reset Password</a>
  </div>
  <p style="color:#888;font-size:13px">
    This link expires in 1 hour. If you didn't request a password reset, ignore this email.
  </p>
  ${footer}
</div>
`;

export const signupTemplate = ({
  user,
  url,
}: {
  user: { name: string; email: string };
  url: string;
}): string => `
<div style="${baseStyle}">
  <h1 style="color:#111;font-size:22px">Verify your email address</h1>
  <p style="color:#555">Hi ${user.name},</p>
  <p style="color:#555">
    Thanks for signing up for Netfuel. Click below to verify your email and activate your account.
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${url}" style="${btnStyle}">Verify Email</a>
  </div>
  <p style="color:#888;font-size:13px">If you didn't create this account, ignore this email.</p>
  ${footer}
</div>
`;

export const invitationTemplate = ({
  name,
  url,
  email,
  password,
}: {
  name: string;
  url: string;
  email: string;
  password: string;
}): string => `
<div style="${baseStyle}">
  <h1 style="color:#111;font-size:22px">You've been invited to Netfuel</h1>
  <p style="color:#555">Hi ${name},</p>
  <p style="color:#555">You have been invited to join Netfuel. Use the credentials below to sign in:</p>
  <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0">
    <p style="margin:4px 0;color:#333"><strong>Email:</strong> ${email}</p>
    <p style="margin:4px 0;color:#333"><strong>Temporary Password:</strong> ${password}</p>
  </div>
  <div style="text-align:center;margin:24px 0">
    <a href="${url}" style="${btnStyle}">Accept Invitation</a>
  </div>
  <p style="color:#888;font-size:13px">Please change your password after your first login.</p>
  ${footer}
</div>
`;
