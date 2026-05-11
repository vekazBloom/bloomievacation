import type { ReactElement } from 'react';
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY is not set — emails will fail to send.');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

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
