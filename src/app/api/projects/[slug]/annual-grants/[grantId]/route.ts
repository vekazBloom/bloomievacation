import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sumAllocatedToGrant } from '@/lib/leave/entitlement-grants';
import { syncUserLeaveTotals } from '@/lib/leave/global-balance';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { createServiceClient } from '@/lib/supabase/server';

const patchSchema = z.object({
  definition_id: z.string().uuid().nullable().optional(),
  days_allocated: z.number().min(0).optional(),
}).refine((d) => d.definition_id !== undefined || d.days_allocated !== undefined, {
  message: 'Send definition_id and/or days_allocated',
});

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
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] || 'Invalid payload' },
      { status: 400 }
    );
  }

  const p = parsed.data;

  const { data: grant, error: gErr } = await supabase
    .from('annual_entitlement_grants')
    .select(
      'id, project_id, user_id, source, label, days_allocated, grant_year, valid_from, valid_to, definition_id'
    )
    .eq('id', params.grantId)
    .eq('project_id', project.id)
    .maybeSingle();

  if (gErr || !grant) {
    return NextResponse.json({ error: gErr?.message || 'Grant not found' }, { status: 404 });
  }

  const reserved = await sumAllocatedToGrant(supabase, grant.id);
  const nextDays =
    p.days_allocated !== undefined ? p.days_allocated : Number(grant.days_allocated ?? 0);

  if (nextDays + 1e-9 < reserved) {
    return NextResponse.json(
      {
        error: `Allocated days cannot be below reserved total (${reserved.toFixed(1)} working day(s) on approved/pending requests).`,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  let defPatch: Record<string, unknown> = {};
  if (p.definition_id !== undefined) {
    if (p.definition_id === null) {
      defPatch = { definition_id: null, updated_at: now };
    } else {
      const { data: def, error: dErr } = await supabase
        .from('project_annual_fund_definitions')
        .select('id, label, grant_year, valid_from, valid_to')
        .eq('id', p.definition_id)
        .eq('project_id', project.id)
        .maybeSingle();

      if (dErr || !def) {
        return NextResponse.json({ error: 'Fund definition not found' }, { status: 400 });
      }

      defPatch = {
        definition_id: def.id,
        label: def.label,
        grant_year: def.grant_year,
        valid_from: def.valid_from,
        valid_to: def.valid_to,
        updated_at: now,
      };
    }
  }

  if (grant.source === 'legacy_migration') {
    if (p.days_allocated !== undefined) {
      const { data: member, error: mErr } = await supabase
        .from('project_members')
        .select('id, annual_leave_total, annual_leave_carried_over')
        .eq('project_id', project.id)
        .eq('user_id', grant.user_id)
        .maybeSingle();

      if (mErr || !member) {
        return NextResponse.json({ error: mErr?.message || 'Project member not found' }, { status: 400 });
      }

      const carried = Number(member.annual_leave_carried_over ?? 0);
      const newAnnualTotal = Math.max(0, Math.round(Number(nextDays) - carried));

      const { error: upM } = await supabase
        .from('project_members')
        .update({ annual_leave_total: newAnnualTotal })
        .eq('id', member.id);

      if (upM) return NextResponse.json({ error: upM.message }, { status: 500 });

      const service = createServiceClient();
      const syncResult = await syncUserLeaveTotals(service, grant.user_id as string, {
        annual_leave_total: newAnnualTotal,
      });
      if (syncResult.error) {
        return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
      }
    }

    if (Object.keys(defPatch).length > 0) {
      const { error: uErr } = await supabase
        .from('annual_entitlement_grants')
        .update(defPatch)
        .eq('id', grant.id);

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const { data: fresh, error: fErr } = await supabase
      .from('annual_entitlement_grants')
      .select(
        'id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, definition_id'
      )
      .eq('id', grant.id)
      .single();

    if (fErr || !fresh) {
      return NextResponse.json({ error: fErr?.message || 'Failed to reload grant' }, { status: 500 });
    }

    return NextResponse.json({ grant: fresh, reserved_working_days: reserved });
  }

  const grantUpdate: Record<string, unknown> = {};
  if (p.definition_id !== undefined) {
    Object.assign(grantUpdate, defPatch);
  }
  if (p.days_allocated !== undefined) {
    grantUpdate.days_allocated = nextDays;
  }
  if (Object.keys(grantUpdate).length === 0) {
    return NextResponse.json({ error: 'No changes applied' }, { status: 400 });
  }

  const { data: updated, error: uErr } = await supabase
    .from('annual_entitlement_grants')
    .update(grantUpdate)
    .eq('id', grant.id)
    .select(
      'id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, definition_id'
    )
    .single();

  if (uErr || !updated) {
    return NextResponse.json({ error: uErr?.message || 'Failed to update grant' }, { status: 500 });
  }

  return NextResponse.json({ grant: updated, reserved_working_days: reserved });
}
