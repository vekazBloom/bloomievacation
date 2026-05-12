'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearInvitationSyncCompleted,
  hasInvitationSyncCompleted,
  markInvitationSyncCompleted,
} from '@/lib/invitations/session-sync';

export function SessionInvitationSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId || hasInvitationSyncCompleted(userId)) {
      return;
    }

    markInvitationSyncCompleted(userId);

    void (async () => {
      const response = await fetch('/api/invitations/sync', { method: 'POST' });
      if (!response.ok) {
        clearInvitationSyncCompleted(userId);
        return;
      }

      router.refresh();
    })();
  }, [userId, router]);

  return null;
}
