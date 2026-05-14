import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

const updateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
    vacation_threshold_percent: z.number().int().min(1).max(100).optional(),
    year_reset_month: z.number().int().min(1).max(12).optional(),
    year_reset_day: z.number().int().min(1).max(31).optional(),
    carry_over_policy: z.enum(['ask', 'auto_transfer', 'auto_lose']).optional(),
    annual_accrual_month: z.number().int().min(1).max(12).optional(),
    annual_accrual_day: z.number().int().min(1).max(31).optional(),
    annual_first_use_by_month: z.number().int().min(1).max(12).nullable().optional(),
    annual_first_use_by_day: z.number().int().min(1).max(31).nullable().optional(),
    archive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const m = data.annual_first_use_by_month;
      const d = data.annual_first_use_by_day;
      if (m === undefined && d === undefined) return true;
      if (m === null && d === null) return true;
      if (m != null && d != null) return true;
      return false;
    },
    { path: ['annual_first_use_by_month'], message: 'Set both first-use-by month and day, or clear both.' }
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const payload: Record<string, unknown> = { ...parsed.data };
  delete payload.archive;

  if (parsed.data.archive === true) {
    payload.is_archived = true;
    payload.archived_at = new Date().toISOString();
  } else if (parsed.data.archive === false) {
    payload.is_archived = false;
    payload.archived_at = null;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', project.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
