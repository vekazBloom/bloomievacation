const DEFAULT_REDIRECT_PATH = '/dashboard';

export function sanitizeInternalRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH
) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }

  if (trimmed.includes('://')) {
    return fallback;
  }

  return trimmed;
}
