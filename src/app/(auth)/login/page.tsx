import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { inviteTokenFromAcceptRedirect, signupPathForInvite } from '@/lib/invitations/invite-paths';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string; email?: string };
}) {
  const inviteToken = inviteTokenFromAcceptRedirect(searchParams.redirectTo);
  const signupHref = inviteToken
    ? signupPathForInvite(inviteToken, searchParams.email)
    : '/signup';

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm sm:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage time off for you and your team.
        </p>
      </div>

      {searchParams.error === 'auth-callback' ? (
        <p className="mb-4 text-sm text-destructive">
          Email confirmation link expired or invalid. Sign in below or request a new invite.
        </p>
      ) : null}

      <LoginForm redirectTo={searchParams.redirectTo} prefilledEmail={searchParams.email} />

      <div className="mt-8 border-t border-border pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href={signupHref} className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
