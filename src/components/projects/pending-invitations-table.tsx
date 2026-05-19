'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatEmailDate, formatRoleLabel } from '@/lib/email/format';

type PendingInvitation = {
  id: string;
  email: string;
  role: 'admin' | 'lead' | 'employee';
  expires_at: string;
  created_at: string | null;
  projectName?: string | null;
  projectSlug?: string | null;
  roleSummary?: string;
};

const RESEND_COOLDOWN_SECONDS = 60;

export function PendingInvitationsTable({
  invitations,
  title = 'Pending invitations',
  description,
}: {
  invitations: PendingInvitation[];
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  const nowSeconds = Math.floor(Date.now() / 1000);
  const sortedInvitations = useMemo(
    () =>
      [...invitations].sort((a, b) => {
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bCreated - aCreated;
      }),
    [invitations]
  );

  async function onResend(invitation: PendingInvitation) {
    setResendingId(invitation.id);
    const response = await fetch(`/api/invitations/${invitation.id}/resend`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    setResendingId(null);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to resend invitation');
      return;
    }

    setCooldowns((current) => ({
      ...current,
      [invitation.id]: Math.floor(Date.now() / 1000) + RESEND_COOLDOWN_SECONDS,
    }));
    toast.success(`Invitation re-sent to ${invitation.email}`);
    router.refresh();
  }

  return (
    <Card>
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <CardContent className="divide-y divide-border p-0">
        {sortedInvitations.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          sortedInvitations.map((invite) => {
            const expiresAtMs = new Date(invite.expires_at).getTime();
            const isExpired = Number.isFinite(expiresAtMs) ? expiresAtMs < Date.now() : false;
            const cooldownUntil = cooldowns[invite.id] || 0;
            const cooldownLeft = Math.max(0, cooldownUntil - nowSeconds);
            const isResending = resendingId === invite.id;
            const isDisabled = isResending || cooldownLeft > 0;

            return (
              <div key={invite.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {invite.projectName ? `${invite.projectName} · ` : ''}
                    {invite.roleSummary ?? formatRoleLabel(invite.role)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatEmailDate(invite.expires_at)}
                    {isExpired ? ' (expired)' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!invite.roleSummary ? (
                    <Badge variant="outline" className="font-mono uppercase">
                      {formatRoleLabel(invite.role)}
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onResend(invite)}
                    disabled={isDisabled}
                  >
                    {isResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {cooldownLeft > 0 ? `Retry in ${cooldownLeft}s` : 'Resend'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

