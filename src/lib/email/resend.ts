import type { ReactElement } from 'react';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM || 'BloomieVacation <onboarding@resend.dev>';

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  react?: ReactElement;
  html?: string;
  text?: string;
};

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not set — skipping email send.');
    return { success: false, error: new Error('RESEND_API_KEY is not configured') };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      react: params.react,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error('[email] send failed:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[email] send threw:', err);
    return { success: false, error: err };
  }
}
