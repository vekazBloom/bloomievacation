/**
 * Normalize a phone number to E.164 for storage and matching.
 * Defaults to Bosnia (+387) when no country code is present.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode = '387'): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  } else if (!digits.startsWith(defaultCountryCode) && digits.length <= 10) {
    digits = `${defaultCountryCode}${digits}`;
  }

  digits = digits.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}
