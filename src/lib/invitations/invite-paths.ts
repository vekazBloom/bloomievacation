/** Extract invitation token from accept redirect path. */
export function inviteTokenFromAcceptRedirect(redirectTo?: string | null): string | null {
  if (!redirectTo) return null;
  const match = redirectTo.match(/[?&]token=([^&]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function signupPathForInvite(token: string, email?: string) {
  const params = new URLSearchParams({ invite: token });
  if (email) params.set('email', email);
  return `/signup?${params.toString()}`;
}
