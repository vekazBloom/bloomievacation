function normalizeAppUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (vercelUrl) {
    return normalizeAppUrl(vercelUrl);
  }

  return 'http://localhost:3000';
}

export function absoluteAppUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
}
