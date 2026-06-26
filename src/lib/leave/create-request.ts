import { z } from 'zod';
import { notifyRequestSubmitted } from '@/lib/leave/notify';
import {
  fetchAnnualGrantSplitHints,
  fetchGrantsForUser,
  replaceAnnualAllocations,
  validateExplicitAnnualAllocations,
  type AnnualAllocationInput,
} from '@/lib/leave/entitlement-grants';
import { fetchSickLeavePoolsForUser } from '@/lib/leave/sick-leave-pools';
import { leaveRequestWithUserAvatarSelect } from '@/lib/leave/queries';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { isValidSickLeaveAttachmentPath } from '@/lib/security/attachment';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveType } from '@/types/database';

export const createLeaveRequestSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['annual', 'sick', 'religious']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
  annualAllocations: z
    .array(
      z.object({
        grantId: z.string().uuid(),
        workingDays: z.number().positive(),
      })
    )
    .optional(),
  balanceProjectId: z.string().uuid().optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export type CreateLeaveRequestResult =
  | { ok: true; request: Record<string, unknown> }
  | { ok: false; error: string; status: number };

async function insertLeaveRequest(
  supabase: AppSupabase,
  userId: string,
  input: CreateLeaveRequestInput
) {
  const {
    projectId,
    type,
    startDate,
    endDate,
    reason,
    attachmentUrl,
    annualAllocations,
    balanceProjectId,
  } = input;

  if (attachmentUrl && type !== 'sick') {
    return { error: 'Attachments are only allowed for sick leave', status: 400 as const };
  }

  if (attachmentUrl && !isValidSickLeaveAttachmentPath(attachmentUrl, userId)) {
    return { error: 'Invalid attachment path', status: 400 as const };
  }

  const { data: workingDays, error: workingDaysError } = await supabase.rpc(
    'calculate_working_days',
    { p_start: startDate, p_end: endDate }
  );
  if (workingDaysError) {
    return { error: workingDaysError.message, status: 500 as const };
  }

  const wd = workingDays ?? 0;

  let resolvedAnnualAllocations: AnnualAllocationInput[] | undefined =
    type === 'annual' ? annualAllocations : undefined;

  let resolvedBalanceProjectId: string | undefined;

  if (type === 'annual') {
    const grants = await fetchGrantsForUser(supabase, userId);

    if (grants.length > 0) {
      if (!resolvedAnnualAllocations || resolvedAnnualAllocations.length === 0) {
        const auto = await autoPickAnnualAllocations(supabase, userId, projectId, startDate, wd);
        if (!auto.ok) {
          return { error: auto.error, status: auto.status };
        }
        resolvedAnnualAllocations = auto.allocations;
      } else {
        const explicitCheck = validateExplicitAnnualAllocations(grants, resolvedAnnualAllocations);
        if (!explicitCheck.ok) {
          return { error: explicitCheck.error, status: 400 as const };
        }
        const sum = resolvedAnnualAllocations.reduce((total, row) => total + row.workingDays, 0);
        if (Math.abs(sum - wd) > 0.02) {
          return {
            error: 'Annual fund days must equal the working days for this request.',
            status: 400 as const,
          };
        }
      }
    }
  }

  if (type === 'sick') {
    const pools = await fetchSickLeavePoolsForUser(supabase, userId);
    if (pools.length === 0) {
      return { error: 'No sick leave pool is configured for your account.', status: 400 as const };
    }
    if (!balanceProjectId) {
      if (pools.length === 1) {
        resolvedBalanceProjectId = pools[0].projectId;
      } else {
        return {
          error: 'Select which sick leave pool (project) to use.',
          status: 400 as const,
        };
      }
    } else if (!pools.some((pool) => pool.projectId === balanceProjectId)) {
      return { error: 'Invalid sick leave pool for this user.', status: 400 as const };
    } else {
      resolvedBalanceProjectId = balanceProjectId;
    }
  }

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId,
    projectId,
    type: type as LeaveType,
    workingDays: wd,
    annualAllocations: resolvedAnnualAllocations,
    balanceProjectId: resolvedBalanceProjectId,
  });
  if (!balanceCheck.ok) {
    return { error: balanceCheck.error, status: balanceCheck.status };
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    project_id: projectId,
    type: type as LeaveType,
    start_date: startDate,
    end_date: endDate,
    working_days_count: wd,
    status: 'pending',
    reason: reason ?? null,
    attachment_url: attachmentUrl ?? null,
  };
  if (resolvedBalanceProjectId) {
    insertPayload.balance_project_id = resolvedBalanceProjectId;
  }

  const { data: requestRow, error } = await supabase
    .from('leave_requests')
    .insert(insertPayload)
    .select(leaveRequestWithUserAvatarSelect)
    .single();

  if (error) return { error: error.message, status: 500 as const };

  if (type === 'annual' && resolvedAnnualAllocations && resolvedAnnualAllocations.length > 0) {
    const { error: allocError } = await replaceAnnualAllocations(
      supabase,
      requestRow.id,
      resolvedAnnualAllocations
    );
    if (allocError) {
      await supabase.from('leave_requests').delete().eq('id', requestRow.id);
      return { error: allocError.message || 'Failed to save entitlement split', status: 500 as const };
    }
  }

  await supabase.from('leave_request_history').insert({
    request_id: requestRow.id,
    action: 'created',
    performed_by: userId,
    snapshot: requestRow,
  });

  const service = createServiceClient();
  const { data: employee } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .maybeSingle();

  await notifyRequestSubmitted(service, {
    projectId,
    requestId: requestRow.id,
    employeeName: employee?.name || 'Employee',
    employeeEmail: employee?.email || '',
    projectName: (requestRow.projects as { name?: string } | null)?.name || 'Project',
    leaveType: type as LeaveType,
    startDate,
    endDate,
  });

  return { request: requestRow };
}

async function autoPickAnnualAllocations(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  startDate: string,
  workingDays: number
): Promise<
  | { ok: true; allocations: AnnualAllocationInput[] }
  | { ok: false; error: string; status: number }
> {
  const hints = await fetchAnnualGrantSplitHints(supabase, projectId, userId, startDate);
  if (hints.eligible.length === 0) {
    return {
      ok: false,
      error: 'Nema dostupnog godišnjeg fonda za izabrani datum.',
      status: 400,
    };
  }
  if (hints.requiresSplit) {
    return {
      ok: false,
      error:
        'Više godišnjih fondova pokriva ovaj period. Odaberite fond u web aplikaciji ili navedite koji fond želite.',
      status: 400,
    };
  }
  const grant = hints.eligible[0];
  if (grant.remaining < workingDays) {
    return {
      ok: false,
      error: `Nedovoljno dana na fondu "${grant.label}". Preostalo: ${grant.remaining.toFixed(1)}.`,
      status: 400,
    };
  }
  return { ok: true, allocations: [{ grantId: grant.id, workingDays }] };
}

export async function createLeaveRequest(
  supabase: AppSupabase,
  userId: string,
  input: CreateLeaveRequestInput
): Promise<CreateLeaveRequestResult> {
  const parsed = createLeaveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid payload', status: 400 };
  }

  const result = await insertLeaveRequest(supabase, userId, parsed.data);
  if ('error' in result && result.error) {
    return { ok: false, error: result.error, status: result.status };
  }
  return { ok: true, request: result.request! };
}

export async function previewLeaveRequest(
  supabase: AppSupabase,
  userId: string,
  input: CreateLeaveRequestInput
): Promise<
  | {
      ok: true;
      workingDays: number;
      overlap: {
        totalMembers: number;
        overlappingMembers: number;
        thresholdPercent: number;
        overlapPercent: number;
        exceedsThreshold: boolean;
      };
      resolvedInput: CreateLeaveRequestInput;
    }
  | { ok: false; error: string }
> {
  const parsed = createLeaveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Neispravni podaci zahtjeva.' };
  }

  let payload = { ...parsed.data };

  const { data: workingDays, error: wdError } = await supabase.rpc('calculate_working_days', {
    p_start: payload.startDate,
    p_end: payload.endDate,
  });
  if (wdError) return { ok: false, error: wdError.message };

  const wd = workingDays ?? 0;

  if (payload.type === 'annual' && !payload.annualAllocations?.length) {
    const auto = await autoPickAnnualAllocations(
      supabase,
      userId,
      payload.projectId,
      payload.startDate,
      wd
    );
    if (!auto.ok) return { ok: false, error: auto.error };
    payload = { ...payload, annualAllocations: auto.allocations };
  }

  if (payload.type === 'sick' && !payload.balanceProjectId) {
    const pools = await fetchSickLeavePoolsForUser(supabase, userId);
    if (pools.length === 1) {
      payload = { ...payload, balanceProjectId: pools[0].projectId };
    }
  }

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId,
    projectId: payload.projectId,
    type: payload.type as LeaveType,
    workingDays: wd,
    annualAllocations: payload.annualAllocations,
    balanceProjectId: payload.balanceProjectId,
  });
  if (!balanceCheck.ok) {
    return { ok: false, error: balanceCheck.error };
  }

  const { data: overlapRows, error: overlapError } = await supabase.rpc('check_vacation_overlap', {
    p_project_id: payload.projectId,
    p_start: payload.startDate,
    p_end: payload.endDate,
    p_exclude_request_id: null,
  });
  if (overlapError) return { ok: false, error: overlapError.message };

  const overlap = overlapRows?.[0];
  const totalMembers = overlap?.total_members ?? 0;
  const overlappingMembers = overlap?.overlapping_members ?? 0;
  const thresholdPercent = overlap?.threshold_percent ?? 50;
  const overlapPercent =
    totalMembers > 0 ? Math.round((overlappingMembers / totalMembers) * 100) : 0;

  return {
    ok: true,
    workingDays: wd,
    overlap: {
      totalMembers,
      overlappingMembers,
      thresholdPercent,
      overlapPercent,
      exceedsThreshold: overlapPercent >= thresholdPercent,
    },
    resolvedInput: payload,
  };
}
