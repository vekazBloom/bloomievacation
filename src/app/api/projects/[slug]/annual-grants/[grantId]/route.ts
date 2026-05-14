import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sumAllocatedToGrant } from '@/lib/leave/entitlement-grants';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  valid_from: isoDate.optional(),
  valid_to: z.union([isoDate, z.null()]).optional(),
  grant_year: z.union([z.number().int().min(1900).max(2100), z.null()]).optional(),
  days_allocated: z.number().nonnegative().optional(),
});

function mergedValidRange(
  existing: { valid_from: string; valid_to: string | null },
  patch: z.infer<typeof patchSchema>
): { valid_from: string; valid_to: string | null } {
  const valid_from = patch.valid_from ?? existing.valid_from;
  const valid_to = patch.valid_to !== undefined ? patch.valid_to : existing.valid_to;
  return { valid_from, valid_to };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; grantId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('annual_entitlement_grants')
    .select('id, project_id, user_id, label, grant_year, days_allocated, valid_from, valid_to, source')
    .eq('id', params.grantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message || 'Grant not found' }, { status: 404 });
  }

  if (existing.project_id !== project.id) {
    return NextResponse.json({ error: 'Grant does not belong to this project' }, { status: 400 });
  }

  const isLegacy = existing.source === 'legacy_migration';

  if (isLegacy && parsed.data.days_allocated !== undefined) {
    return NextResponse.json(
      {
        error:
          'Legacy fund pool size is synced from member annual totals. Edit balances on the Members page instead of days_allocated here.',
      },
      { status: 400 }
    );
  }

  const { valid_from, valid_to } = mergedValidRange(
    { valid_from: existing.valid_from, valid_to: existing.valid_to },
    parsed.data
  );
  if (valid_to && valid_from > valid_to) {
    return NextResponse.json({ error: 'valid_to must be on or after valid_from' }, { status: 400 });
  }

  if (!isLegacy && parsed.data.days_allocated !== undefined) {
    const reserved = await sumAllocatedToGrant(supabase, params.grantId);
    if (parsed.data.days_allocated + 1e-6 < reserved) {
      return NextResponse.json(
        {
          error: `days_allocated cannot be below pending/approved allocations on this fund (${reserved.toFixed(1)} day(s)).`,
        },
        { status: 400 }
      );
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updatePayload.label = parsed.data.label;
  if (parsed.data.valid_from !== undefined) updatePayload.valid_from = parsed.data.valid_from;
  if (parsed.data.valid_to !== undefined) updatePayload.valid_to = parsed.data.valid_to;
  if (parsed.data.grant_year !== undefined) updatePayload.grant_year = parsed.data.grant_year;
  if (!isLegacy && parsed.data.days_allocated !== undefined) {
    updatePayload.days_allocated = parsed.data.days_allocated;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('annual_entitlement_grants')
    .update(updatePayload)
    .eq('id', params.grantId)
    .select('id, project_id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ grant: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string; grantId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: existing, error: fetchErr } = await supabase
    .from('annual_entitlement_grants')
    .select('id, project_id, source')
    .eq('id', params.grantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message || 'Grant not found' }, { status: 404 });
  }

  if (existing.project_id !== project.id) {
    return NextResponse.json({ error: 'Grant does not belong to this project' }, { status: 400 });
  }

  if (existing.source === 'legacy_migration') {
    return NextResponse.json(
      { error: 'Deleting the legacy entitlement row is not supported from the app.' },
      { status: 400 }
    );
  }

  const { count, error: countErr } = await supabase
    .from('leave_request_grant_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('grant_id', params.grantId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This fund has leave allocations; remove or reassign allocations before deleting.' },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabase.from('annual_entitlement_grants').delete().eq('id', params.grantId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
