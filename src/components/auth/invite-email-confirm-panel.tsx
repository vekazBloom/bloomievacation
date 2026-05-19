'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signupPathForInvite } from '@/lib/invitations/invite-paths';

function inviteAcceptPath(token: string) {
  return `/api/invitations/accept?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent('/dashboard')}`;
}

export function InviteEmailConfirmPanel({
  email,
  inviteToken,
}: {
  email: string;
  inviteToken: string;
}) {
  const signupHref = signupPathForInvite(inviteToken, email);
  const loginHref = `/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(email)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h2 className="font-medium text-foreground">Finish your account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A signup was started for <strong>{email}</strong> but not completed. Set your name and
          password to finish — no confirmation email required; your invite link already verified
          this address.
        </p>
      </div>

      <Button asChild size="lg" className="w-full">
        <Link href={signupHref}>Finish creating account</Link>
      </Button>

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href={loginHref}>Already finished? Sign in</Link>
      </Button>
    </div>
  );
}
