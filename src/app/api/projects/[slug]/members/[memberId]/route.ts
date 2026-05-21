import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUserLeaveTotals } from '@/lib/leave/global-balance';
import { ensureMemberFundGrantsForAssignments } from '@/lib/leave/ensure-member-fund-grants';
import { realignAnnualGrantAllocationsForMember } from '@/lib/leave/entitlement-grants';
import { replaceUserAnnualFundAssignmentsAndSyncLegacy } from '@/lib/leave/sync-user-annual-definition-assignments';
import { canEditMemberLeaveBalances, canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { createServiceClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

const updateSchema = z.object({
  role: z.enum(['admin', 'lead', 'employee']).optional(),
  annual_leave_total: z.number().int().min(0).optional(),
  sick_leave_total: z.number().int().min(0).optional(),
  religious_leave_total: z.number().int().min(0).optional(),
  /** @deprecated Prefer annual_fund_definition_ids; kept for older clients (single template). */
  annual_fund_definition_id: z.string().uuid().nullable().optional(),
  /** Global templates this user is assigned to; legacy pool metadata uses the first by sort order + label. */
  annual_fund_definition_ids: z.array(z.string().uuid()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const p = parsed.data;

  const touchesLeaveBalances =
    p.annual_leave_total !== undefined ||
    p.sick_leave_total !== undefined ||
    p.religious_leave_total !== undefined;

  const touchesMembershipMeta =
    p.role !== undefined ||
    p.annual_fund_definition_ids !== undefined ||
    p.annual_fund_definition_id !== undefined;

  if (touchesLeaveBalances) {
    const allowedBalances = await canEditMemberLeaveBalances(user.id);
    if (!allowedBalances) {
      return NextResponse.json(
        { error: 'Only system administrators can edit leave day totals.' },
        { status: 403 }
      );
    }
  }

  if (touchesMembershipMeta) {
    const allowedManage = await canManageProject(project.id, user.id);
    if (!allowedManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!touchesLeaveBalances && !touchesMembershipMeta) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const memberUpdate: {
    role?: ProjectRole;
    annual_leave_total?: number;
    sick_leave_total?: number;
    religious_leave_total?: number;
  } = {};
  if (p.role !== undefined) memberUpdate.role = p.role as ProjectRole;
  if (p.annual_leave_total !== undefined) memberUpdate.annual_leave_total = p.annual_leave_total;
  if (p.sick_leave_total !== undefined) memberUpdate.sick_leave_total = p.sick_leave_total;
  if (p.religious_leave_total !== undefined) memberUpdate.religious_leave_total = p.religious_leave_total;

  let data: Record<string, unknown>;

  if (Object.keys(memberUpdate).length > 0) {
    const { data: updated, error } = await supabase
      .from('project_members')
      .update(memberUpdate)
      .eq('id', params.memberId)
      .eq('project_id', project.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = updated as Record<string, unknown>;
  } else {
    const { data: current, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', params.memberId)
      .eq('project_id', project.id)
      .maybeSingle();

    if (error || !current) {
      return NextResponse.json({ error: error?.message || 'Member not found' }, { status: 404 });
    }
    data = current as Record<string, unknown>;
  }

  if (
    p.annual_leave_total !== undefined ||
    p.sick_leave_total !== undefined ||
    p.religious_leave_total !== undefined
  ) {
    const service = createServiceClient();
    const syncResult = await syncUserLeaveTotals(service, data.user_id as string, {
      annual_leave_total: p.annual_leave_total,
      sick_leave_total: p.sick_leave_total,
      religious_leave_total: p.religious_leave_total,
    });
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
    }
  }

  let idsToApply: string[] | undefined;
  if (p.annual_fund_definition_ids !== undefined) {
    idsToApply = p.annual_fund_definition_ids;
  } else if (p.annual_fund_definition_id !== undefined) {
    idsToApply = p.annual_fund_definition_id ? [p.annual_fund_definition_id] : [];
  }

  if (idsToApply !== undefined) {
    const service = createServiceClient();
    const syncAssign = await replaceUserAnnualFundAssignmentsAndSyncLegacy(
      service,
      data.user_id as string,
      idsToApply
    );
    if (syncAssign.error) {
      return NextResponse.json({ error: syncAssign.error }, { status: 400 });
    }

    const ensureGrants = await ensureMemberFundGrantsForAssignments(service, {
      projectId: project.id,
      userId: data.user_id as string,
      assignedDefinitionIds: idsToApply,
    });
    if (ensureGrants.error) {
      return NextResponse.json({ error: ensureGrants.error }, { status: 400 });
    }

    const realign = await realignAnnualGrantAllocationsForMember(
      service,
      project.id,
      data.user_id as string
    );
    if (realign.error) {
      return NextResponse.json({ error: realign.error }, { status: 400 });
    }
  }

  return NextResponse.json({ member: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', params.memberId)
    .eq('project_id', project.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
