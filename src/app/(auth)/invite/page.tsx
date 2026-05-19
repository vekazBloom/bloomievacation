import { redirect } from 'next/navigation';
import { authUserExistsForEmail } from '@/lib/auth/admin-users';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/dashboard';
import { buildInviteRoleSummary } from '@/lib/email/format';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RemoteImage } from '@/components/ui/remote-image';

type Props = { searchParams: { token?: string } };

export default async function InvitePage({ searchParams }: Props) {
  const token = searchParams.token;

  if (!token) {
    return <InviteError message="No invitation token provided." />;
  }

  // Use service client to read invite (RLS would block unauthenticated read).
  const service = createServiceClient();
  const { data: invite, error } = await service
    .from('invitations')
    .select('*, projects(name, logo_url)')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    return <InviteError message="This invitation link is invalid or has expired." />;
  }

  if (invite.accepted_at) {
    return <InviteError message="This invitation has already been used." />;
  }

  if (new Date(invite.expires_at) < new Date()) {
    return <InviteError message="This invitation has expired. Ask the admin to send a new one." />;
  }

  // Check if user is logged in.
  const { user } = await getAuthenticatedUser();

  const inviteEmail = invite.email.trim().toLowerCase();

  const [{ data: existingUser }, hasAuthAccount] = await Promise.all([
    service.from('users').select('id').ilike('email', inviteEmail).maybeSingle(),
    authUserExistsForEmail(service, inviteEmail),
  ]);

  const accountExists = Boolean(existingUser) || hasAuthAccount;

  // Logged in & email matches → auto-redirect to API to accept.
  if (user && user.email?.toLowerCase() === inviteEmail) {
    redirect(`/api/invitations/accept?token=${token}&redirect=/dashboard`);
  }

  const roleSummary = buildInviteRoleSummary({
    projectRole: invite.role,
    grantSystemAdmin: Boolean(invite.grant_system_admin),
    hasProject: Boolean(invite.project_id),
  });

  // Logged in but with different email → log out hint.
  if (user && user.email?.toLowerCase() !== inviteEmail) {
    return (
      <InviteCard project={invite.projects}>
        <p className="text-sm text-muted-foreground">
          You&apos;re currently signed in as <strong>{user.email}</strong>, but this invite was
          sent to <strong>{invite.email}</strong>. Please sign out and sign in with the right
          account.
        </p>
        <form action="/api/auth/signout" method="post" className="mt-4">
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </InviteCard>
    );
  }

  // Not logged in: existing user → login; new user → signup.
  const acceptRedirect = `/api/invitations/accept?token=${token}&redirect=/dashboard`;
  const targetPath = accountExists
    ? `/login?redirectTo=${encodeURIComponent(acceptRedirect)}&email=${encodeURIComponent(invite.email)}`
    : `/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`;

  return (
    <InviteCard project={invite.projects}>
      <div className="space-y-1">
        <p className="text-sm">
          You&apos;ve been invited with access:{' '}
          <span className="font-medium text-foreground">{roleSummary}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Sent to <strong>{invite.email}</strong>
        </p>
      </div>

      <Button asChild size="lg" className="w-full">
        <Link href={targetPath}>
          {accountExists ? 'Sign in to accept' : 'Create account to accept'}
        </Link>
      </Button>
    </InviteCard>
  );
}

function InviteCard({
  project,
  children,
}: {
  project: { name: string; logo_url: string | null } | null;
  children: React.ReactNode;
}) {
  const title = project?.name ?? 'BloomieVacation';
  const initial = project?.name?.[0]?.toUpperCase() ?? 'B';

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm sm:p-10">
      <div className="mb-6 flex items-center gap-4">
        {project?.logo_url ? (
          <RemoteImage
            src={project.logo_url}
            alt={project.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 font-display text-2xl text-primary">
            {initial}
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">You&apos;re invited to</p>
          <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-10 text-center shadow-xl backdrop-blur-sm">
      <h1 className="font-display text-2xl font-medium tracking-tight">Hmm, something&apos;s off</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
