import { headers } from 'next/headers';

const DEFAULT_LOCAL_APP_URL = 'http://localhost:3000';

function normalizeAppUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isLocalAppUrl(url: string) {
  try {
    const resolved = new URL(url.includes('://') ? url : `https://${url}`);
    return isLocalHostname(resolved.hostname);
  } catch {
    return false;
  }
}

function readConfiguredAppUrl() {
  for (const key of ['APP_URL', 'NEXT_PUBLIC_APP_URL'] as const) {
    const value = process.env[key];
    if (value?.trim()) {
      return normalizeAppUrl(value);
    }
  }

  return null;
}

function readVercelAppUrl() {
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppUrl(process.env.VERCEL_URL);
  }

  return null;
}

function readRequestAppUrl() {
  try {
    const requestHeaders = headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (!host) {
      return null;
    }

    const forwardedProto = requestHeaders.get('x-forwarded-proto');
    const protocol =
      forwardedProto?.split(',')[0]?.trim() ??
      (isLocalHostname(host.split(':')[0]) ? 'http' : 'https');

    return normalizeAppUrl(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

export function getAppUrl() {
  const configured = readConfiguredAppUrl();
  const vercel = readVercelAppUrl();
  const request = readRequestAppUrl();

  if (configured && !isLocalAppUrl(configured)) {
    return configured;
  }

  if (request && !isLocalAppUrl(request)) {
    return request;
  }

  if (vercel) {
    return vercel;
  }

  if (configured) {
    return configured;
  }

  if (request) {
    return request;
  }

  return DEFAULT_LOCAL_APP_URL;
}

export function absoluteAppUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
}
