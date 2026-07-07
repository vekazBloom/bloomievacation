import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageRoadmap, getCurrentUser } from '@/lib/projects/access';
import { getRoadmap } from '@/lib/read/roadmap';
import { monthSpanError } from '@/lib/roadmap/validation';

const firstOfMonth = z.string().regex(/^\d{4}-\d{2}-01$/, 'Expected a first-of-month date (YYYY-MM-01)');

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color');

const createSchema = z.object({
  team_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: z.enum(['completed', 'in_progress', 'planned', 'waiting']).default('planned'),
  start_month: z.union([firstOfMonth, z.null()]).optional(),
  end_month: z.union([firstOfMonth, z.null()]).optional(),
  owner: z.union([z.string().max(200), z.null()]).optional(),
  dependencies: z.union([z.string().max(500), z.null()]).optional(),
  notes: z.union([z.string().max(1000), z.null()]).optional(),
  color: z.union([hexColor, z.null()]).optional(),
  depends_on_id: z.union([z.string().uuid(), z.null()]).optional(),
  sort_order: z.number().int().optional(),
});

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await canManageRoadmap(user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const roadmap = await getRoadmap(supabase);
  return NextResponse.json(roadmap);
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await canManageRoadmap(user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const spanError = monthSpanError(parsed.data.start_month, parsed.data.end_month);
  if (spanError) return NextResponse.json({ error: spanError }, { status: 400 });

  const { data, error } = await supabase
    .from('roadmap_items')
    .insert({
      team_id: parsed.data.team_id,
      title: parsed.data.title,
      status: parsed.data.status,
      start_month: parsed.data.start_month ?? null,
      end_month: parsed.data.end_month ?? null,
      owner: parsed.data.owner ?? null,
      dependencies: parsed.data.dependencies ?? null,
      notes: parsed.data.notes ?? null,
      // Only reference newer columns when actually provided, so creating features
      // keeps working even before migrations 033/034 (color, depends_on_id) are applied.
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.depends_on_id !== undefined
        ? { depends_on_id: parsed.data.depends_on_id }
        : {}),
      ...(parsed.data.sort_order !== undefined ? { sort_order: parsed.data.sort_order } : {}),
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
