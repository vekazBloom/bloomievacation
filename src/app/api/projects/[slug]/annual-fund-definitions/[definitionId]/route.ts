import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  grant_year: z.number().int().min(1900).max(2100).nullable().optional(),
  valid_from: isoDate.optional(),
  valid_to: z.union([isoDate, z.null()]).optional(),
  sort_order: z.number().int().optional(),
});

function mergedRange(
  existing: { valid_from: string; valid_to: string | null },
  patch: z.infer<typeof patchSchema>
) {
  const valid_from = patch.valid_from ?? existing.valid_from;
  const valid_to = patch.valid_to !== undefined ? patch.valid_to : existing.valid_to;
  return { valid_from, valid_to };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; definitionId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('project_annual_fund_definitions')
    .select('*')
    .eq('id', params.definitionId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message || 'Definition not found' }, { status: 404 });
  }

  if (existing.project_id !== project.id) {
    return NextResponse.json({ error: 'Definition does not belong to this project' }, { status: 400 });
  }

  const { valid_from, valid_to } = mergedRange(
    { valid_from: existing.valid_from, valid_to: existing.valid_to },
    parsed.data
  );
  if (valid_to && valid_from > valid_to) {
    return NextResponse.json({ error: 'valid_to must be on or after valid_from' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updatePayload.label = parsed.data.label;
  if (parsed.data.grant_year !== undefined) updatePayload.grant_year = parsed.data.grant_year;
  if (parsed.data.valid_from !== undefined) updatePayload.valid_from = parsed.data.valid_from;
  if (parsed.data.valid_to !== undefined) updatePayload.valid_to = parsed.data.valid_to;
  if (parsed.data.sort_order !== undefined) updatePayload.sort_order = parsed.data.sort_order;

  const { data, error } = await supabase
    .from('project_annual_fund_definitions')
    .update(updatePayload)
    .eq('id', params.definitionId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('annual_entitlement_grants')
    .update({
      label: data.label,
      valid_from: data.valid_from,
      valid_to: data.valid_to,
      grant_year: data.grant_year,
      updated_at: new Date().toISOString(),
    })
    .eq('definition_id', params.definitionId);

  return NextResponse.json({ definition: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string; definitionId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: existing, error: fetchErr } = await supabase
    .from('project_annual_fund_definitions')
    .select('id, project_id')
    .eq('id', params.definitionId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message || 'Definition not found' }, { status: 404 });
  }

  if (existing.project_id !== project.id) {
    return NextResponse.json({ error: 'Definition does not belong to this project' }, { status: 400 });
  }

  const { error } = await supabase
    .from('project_annual_fund_definitions')
    .delete()
    .eq('id', params.definitionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
