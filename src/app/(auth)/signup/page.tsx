import Link from 'next/link';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage({
  searchParams,
}: {
  searchParams: { invite?: string; email?: string };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm sm:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          {searchParams.invite
            ? "You've been invited to join a team. Set up your account below."
            : 'Start managing time off for your team in minutes.'}
        </p>
      </div>

      <SignupForm
        prefilledEmail={searchParams.email}
        inviteToken={searchParams.invite}
      />

      <div className="mt-8 border-t border-border pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
