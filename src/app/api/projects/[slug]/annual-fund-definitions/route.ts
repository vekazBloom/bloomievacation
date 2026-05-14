import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  label: z.string().min(1).max(200),
  grant_year: z.number().int().min(1900).max(2100).nullable().optional(),
  valid_from: isoDate,
  valid_to: z.union([isoDate, z.null()]).optional(),
  sort_order: z.number().int().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('project_annual_fund_definitions')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ definitions: data || [] });
}

export async function POST(
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const valid_to =
    parsed.data.valid_to === undefined ? null : parsed.data.valid_to;
  if (valid_to && parsed.data.valid_from > valid_to) {
    return NextResponse.json({ error: 'valid_to must be on or after valid_from' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('project_annual_fund_definitions')
    .insert({
      project_id: project.id,
      label: parsed.data.label,
      grant_year: parsed.data.grant_year ?? null,
      valid_from: parsed.data.valid_from,
      valid_to,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ definition: data });
}
