import Link from 'next/link';
import { LeaveApprovalForwardingPanel } from '@/components/profile/leave-approval-forwarding-panel';
import { getDashboardSession } from '@/lib/auth/dashboard';

export default async function LeaveApprovalForwardingPage() {
  const session = await getDashboardSession();
  if (!session) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <div>
        <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to profile
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Leave approval email copies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional addresses that receive a summary whenever you approve someone&apos;s annual or sick leave.
        </p>
      </div>

      <LeaveApprovalForwardingPanel />
    </div>
  );
}
