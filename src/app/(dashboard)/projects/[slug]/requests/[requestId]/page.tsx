import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { formatEmailDate, formatLeaveTypeLabel } from '@/lib/email/format';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';
import {
  leaveRequestUserEmbed,
  leaveRequestGrantAllocationsEmbed,
  leaveRequestBalanceProjectEmbed,
} from '@/lib/leave/queries';
import { formatDateRange } from '@/lib/utils';
import { formatAnnualRequestFundsSummary, formatLeaveBalancePoolLine, type RequestAllocationRow } from '@/lib/leave/format-annual-request-funds';

function statusBadgeVariant(status: string) {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending') return 'pending' as const;
  if (status === 'rejected' || status === 'cancelled') return 'destructive' as const;
  return 'outline' as const;
}

export default async function ProjectRequestDetailsPage({
  params,
}: {
  params: { slug: string; requestId: string };
}) {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;
  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) notFound();

  const { data: request } = await supabase
    .from('leave_requests')
    .select(
      `id, user_id, type, status, start_date, end_date, reason, decision_note, created_at, working_days_count, balance_project_id, ${leaveRequestUserEmbed}(name, email), ${leaveRequestBalanceProjectEmbed}, ${leaveRequestGrantAllocationsEmbed}`
    )
    .eq('id', params.requestId)
    .eq('project_id', project.id)
    .maybeSingle();

  if (!request) notFound();

  const requestUser = Array.isArray(request.users) ? request.users[0] : request.users;
  const canReview = canReviewLeaveForRole(profile.is_system_admin, membership.role);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={projectPath(project.slug, 'requests')} aria-label="Back to requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Request details</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Employee</p>
              <p className="text-xl font-medium">{requestUser?.name || 'Employee'}</p>
              <p className="text-sm text-muted-foreground">{requestUser?.email || 'No email'}</p>
            </div>
            <Badge variant={statusBadgeVariant(request.status)} className="uppercase">
              {request.status}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Leave type</p>
              <p className="mt-1 font-medium">{formatLeaveTypeLabel(request.type)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Date range</p>
              <p className="mt-1 font-medium">{formatDateRange(request.start_date, request.end_date)}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Working days</p>
              <p className="mt-1 font-medium">{request.working_days_count}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
              <p className="mt-1 font-medium">
                {request.created_at ? formatEmailDate(request.created_at) : 'Unknown'}
              </p>
            </div>
          </div>

          {request.type === 'annual' ? (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual funds</p>
              <p className="mt-1 font-medium">
                {formatAnnualRequestFundsSummary(
                  (request as { leave_request_grant_allocations?: RequestAllocationRow[] | null })
                    .leave_request_grant_allocations
                )}
              </p>
            </div>
          ) : request.type === 'sick' || request.type === 'religious' ? (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance pool</p>
              <p className="mt-1 font-medium">
                {formatLeaveBalancePoolLine(
                  request.type,
                  (request as { balance_project?: { name?: string } | null }).balance_project
                )}
              </p>
            </div>
          ) : null}

          {request.reason ? (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reason</p>
              <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
            </div>
          ) : null}

          {request.decision_note ? (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision note</p>
              <p className="mt-1 whitespace-pre-wrap">{request.decision_note}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={projectPath(project.slug, 'requests')}>Back to all requests</Link>
            </Button>
            {canReview && request.status === 'pending' ? (
              <p className="self-center text-sm text-muted-foreground">
                Pending request can be reviewed from the requests list.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

