import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageRoadmap, getCurrentUser } from '@/lib/projects/access';
import { monthSpanError } from '@/lib/roadmap/validation';

const firstOfMonth = z.string().regex(/^\d{4}-\d{2}-01$/, 'Expected a first-of-month date (YYYY-MM-01)');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color');

const patchSchema = z.object({
  team_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['completed', 'in_progress', 'planned', 'waiting']).optional(),
  start_month: z.union([firstOfMonth, z.null()]).optional(),
  end_month: z.union([firstOfMonth, z.null()]).optional(),
  owner: z.union([z.string().max(200), z.null()]).optional(),
  dependencies: z.union([z.string().max(500), z.null()]).optional(),
  notes: z.union([z.string().max(1000), z.null()]).optional(),
  color: z.union([hexColor, z.null()]).optional(),
  depends_on_id: z.union([z.string().uuid(), z.null()]).optional(),
  sort_order: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { itemId: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await canManageRoadmap(user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  if (Object.keys(parsed.data).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const { data: existing, error: fetchErr } = await supabase
    .from('roadmap_items')
    .select('start_month, end_month')
    .eq('id', params.itemId)
    .maybeSingle();

  if (fetchErr || !existing)
    return NextResponse.json({ error: fetchErr?.message || 'Item not found' }, { status: 404 });

  const nextStart =
    parsed.data.start_month !== undefined ? parsed.data.start_month : existing.start_month;
  const nextEnd = parsed.data.end_month !== undefined ? parsed.data.end_month : existing.end_month;
  const spanError = monthSpanError(nextStart, nextEnd);
  if (spanError) return NextResponse.json({ error: spanError }, { status: 400 });

  const updatePayload: Record<string, unknown> = {};
  for (const key of [
    'team_id',
    'title',
    'status',
    'start_month',
    'end_month',
    'owner',
    'dependencies',
    'notes',
    'color',
    'depends_on_id',
    'sort_order',
  ] as const) {
    if (parsed.data[key] !== undefined) updatePayload[key] = parsed.data[key];
  }

  const { data, error } = await supabase
    .from('roadmap_items')
    .update(updatePayload)
    .eq('id', params.itemId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { itemId: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await canManageRoadmap(user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase.from('roadmap_items').delete().eq('id', params.itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
