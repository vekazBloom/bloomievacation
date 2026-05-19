'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

function inviteAcceptPath(token: string) {
  return `/api/invitations/accept?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent('/dashboard')}`;
}

function emailConfirmRedirectUrl(token: string) {
  const next = inviteAcceptPath(token);
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function InviteEmailConfirmPanel({
  email,
  inviteToken,
}: {
  email: string;
  inviteToken: string;
}) {
  const [isSending, setIsSending] = useState(false);

  async function resendConfirmation() {
    setIsSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: emailConfirmRedirectUrl(inviteToken),
      },
    });
    setIsSending(false);

    if (error) {
      toast.error(error.message || 'Could not resend confirmation email');
      return;
    }

    toast.success('Confirmation email sent. Check your inbox and spam folder.');
  }

  const loginHref = `/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(email)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h2 className="font-medium text-foreground">Confirm your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An account for <strong>{email}</strong> was started but not confirmed yet. Open the
          confirmation link we sent, or request a new one below.
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={isSending}
        onClick={() => void resendConfirmation()}
      >
        {isSending ? <Loader2 className="animate-spin" /> : null}
        {isSending ? 'Sending…' : 'Resend confirmation email'}
      </Button>

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href={loginHref}>Already confirmed? Sign in</Link>
      </Button>
    </div>
  );
}
