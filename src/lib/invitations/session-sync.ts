const invitationSyncKey = (userId: string) => `bloomie:invitation-sync:${userId}`;

export function hasInvitationSyncCompleted(userId: string) {
  try {
    return sessionStorage.getItem(invitationSyncKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markInvitationSyncCompleted(userId: string) {
  try {
    sessionStorage.setItem(invitationSyncKey(userId), '1');
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

export function clearInvitationSyncCompleted(userId: string) {
  try {
    sessionStorage.removeItem(invitationSyncKey(userId));
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}
