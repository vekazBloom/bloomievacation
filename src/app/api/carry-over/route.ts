import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyCarryOverDecision } from '@/lib/carry-over/decisions';
import { getAnnualRemaining } from '@/lib/carry-over/remaining';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectId: z.string().uuid(),
  year: z.number().int(),
  decision: z.enum(['transferred', 'lost']),
  userId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const targetUserId = parsed.data.userId || user.id;
  const isAdmin = await canManageProject(parsed.data.projectId, user.id);
  if (targetUserId !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: membership, error: membershipError } = await service
    .from('project_members')
    .select('annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', parsed.data.projectId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });

  const remainingDays = getAnnualRemaining(membership);
  const { data, error } = await applyCarryOverDecision(service, {
    projectId: parsed.data.projectId,
    userId: targetUserId,
    year: parsed.data.year,
    decision: parsed.data.decision,
    remainingDays,
    decidedBy: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: data });
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get('projectId');
  let query = supabase.from('carry_over_decisions').select('*').eq('user_id', user.id);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisions: data || [] });
}
