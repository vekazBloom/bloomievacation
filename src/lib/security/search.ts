export function sanitizeUserSearchQuery(value: string) {
  return value
    .trim()
    .replace(/[,.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}
