import nodemailer from "nodemailer";
import {
  renderEmailVerificationSuccessEmail,
  renderForgotPasswordOtpEmail,
  renderInvitationEmail,
  renderPasswordResetSuccessEmail,
  renderSignupOtpEmail,
} from "@/emails/templates/auth";
import {
  getSmtpConfig,
  isAuthEmailConfigured,
  isSmtpConfigured,
} from "@/lib/auth/otp/config";
import { createEmailProvider } from "@/lib/notifications/providers/email";
import type { MemberRole } from "@/lib/auth/roles";

export type AuthEmailResult = { ok: true } | { ok: false; message: string };

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendViaSmtp(args: SendArgs): Promise<AuthEmailResult> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return { ok: false, message: "SMTP is not configured." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    await transporter.sendMail({
      from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Unable to send email right now. Please try again.",
    };
  }
}

async function sendViaResend(args: SendArgs): Promise<AuthEmailResult> {
  const provider = createEmailProvider();
  if (!provider.isConfigured()) {
    return { ok: false, message: "Email delivery is not configured." };
  }

  const result = await provider.send({
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: "Unable to send email right now. Please try again.",
    };
  }

  return { ok: true };
}

async function sendAuthEmail(args: SendArgs): Promise<AuthEmailResult> {
  if (!isAuthEmailConfigured()) {
    return {
      ok: false,
      message:
        "Email delivery is not configured. Set SMTP_* or RESEND_* environment variables.",
    };
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp(args);
  }

  return sendViaResend(args);
}

export async function sendSignupOtpEmail(input: {
  to: string;
  fullName?: string | null;
  code: string;
  expiryMinutes: number;
}): Promise<AuthEmailResult> {
  const rendered = renderSignupOtpEmail({
    fullName: input.fullName,
    code: input.code,
    expiryMinutes: input.expiryMinutes,
  });
  return sendAuthEmail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendPasswordResetOtpEmail(input: {
  to: string;
  fullName?: string | null;
  code: string;
  expiryMinutes: number;
}): Promise<AuthEmailResult> {
  const rendered = renderForgotPasswordOtpEmail({
    fullName: input.fullName,
    code: input.code,
    expiryMinutes: input.expiryMinutes,
  });
  return sendAuthEmail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendInvitationEmail(input: {
  to: string;
  restaurantName: string;
  role: MemberRole;
  inviterName?: string | null;
  invitationId: string;
  expiresAt?: string | null;
}): Promise<AuthEmailResult> {
  const rendered = renderInvitationEmail(input);
  return sendAuthEmail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendPasswordResetSuccessEmail(input: {
  to: string;
}): Promise<AuthEmailResult> {
  const rendered = renderPasswordResetSuccessEmail();
  return sendAuthEmail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}

export async function sendEmailVerificationSuccessEmail(input: {
  to: string;
}): Promise<AuthEmailResult> {
  const rendered = renderEmailVerificationSuccessEmail();
  return sendAuthEmail({
    to: input.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}
