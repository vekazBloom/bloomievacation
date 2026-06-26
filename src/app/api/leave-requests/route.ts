import { NextRequest, NextResponse } from 'next/server';
import { createLeaveRequest, createLeaveRequestSchema } from '@/lib/leave/create-request';
import { leaveRequestWithUserAvatarSelect } from '@/lib/leave/queries';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get('projectId');
  const status = request.nextUrl.searchParams.get('status');
  const type = request.nextUrl.searchParams.get('type');

  let query = supabase
    .from('leave_requests')
    .select(leaveRequestWithUserAvatarSelect)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = createLeaveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const result = await createLeaveRequest(supabase, user.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request });
}
