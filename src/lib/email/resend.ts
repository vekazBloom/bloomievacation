import type { ReactElement } from 'react';
import { Resend } from 'resend';

let resendClient: Resend | null = null;
let lastSendAt = 0;

const SEND_SPACING_MS = 250;
const RATE_LIMIT_MAX_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 500;

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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown) {
  if (!error) return { code: '', statusCode: 0, message: '' };
  if (typeof error === 'string') return { code: '', statusCode: 0, message: error };
  if (error instanceof Error) {
    const maybe = error as Error & { code?: string; statusCode?: number; status?: number };
    return {
      code: maybe.code || '',
      statusCode: maybe.statusCode || maybe.status || 0,
      message: maybe.message || '',
    };
  }
  const anyErr = error as { code?: string; statusCode?: number; status?: number; message?: string };
  return {
    code: anyErr.code || '',
    statusCode: anyErr.statusCode || anyErr.status || 0,
    message: anyErr.message || '',
  };
}

function isRateLimitError(error: unknown) {
  const normalized = normalizeError(error);
  return (
    normalized.statusCode === 429 ||
    normalized.code === 'over_email_send_rate_limit' ||
    normalized.message.toLowerCase().includes('rate limit')
  );
}

async function enforceSendSpacing() {
  const now = Date.now();
  const elapsed = now - lastSendAt;
  if (elapsed < SEND_SPACING_MS) {
    await sleep(SEND_SPACING_MS - elapsed);
  }
}

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not set — skipping email send.');
    return { success: false, error: new Error('RESEND_API_KEY is not configured') };
  }

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    try {
      await enforceSendSpacing();
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        react: params.react,
        html: params.html,
        text: params.text,
      });
      lastSendAt = Date.now();

      if (error) {
        if (isRateLimitError(error) && attempt < RATE_LIMIT_MAX_RETRIES) {
          const jitter = Math.floor(Math.random() * 200);
          const delayMs = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt + jitter;
          console.warn(`[email] rate-limited, retrying in ${delayMs}ms (attempt ${attempt + 1})`);
          await sleep(delayMs);
          continue;
        }

        console.error('[email] send failed:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      if (isRateLimitError(err) && attempt < RATE_LIMIT_MAX_RETRIES) {
        const jitter = Math.floor(Math.random() * 200);
        const delayMs = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt + jitter;
        console.warn(`[email] rate-limited (throw), retrying in ${delayMs}ms (attempt ${attempt + 1})`);
        await sleep(delayMs);
        continue;
      }
      console.error('[email] send threw:', err);
      return { success: false, error: err };
    }
  }

  return { success: false, error: new Error('Email retries exhausted') };
}
