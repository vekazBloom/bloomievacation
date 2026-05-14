import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageGlobalAnnualFundDefinitions, getCurrentUser } from '@/lib/projects/access';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  label: z.string().min(1).max(200),
  grant_year: z.number().int().min(1900).max(2100).nullable().optional(),
  valid_from: isoDate,
  valid_to: z.union([isoDate, z.null()]).optional(),
  sort_order: z.number().int().optional(),
});

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('annual_fund_definitions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ definitions: data || [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const allowed = await canManageGlobalAnnualFundDefinitions(user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const valid_to = parsed.data.valid_to === undefined ? null : parsed.data.valid_to;
  if (valid_to && parsed.data.valid_from > valid_to) {
    return NextResponse.json({ error: 'valid_to must be on or after valid_from' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('annual_fund_definitions')
    .insert({
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
