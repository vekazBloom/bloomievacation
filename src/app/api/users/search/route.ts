import { NextRequest, NextResponse } from 'next/server';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const allowed = await canManageProject(projectId, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: existingMembers } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);

  const excludedIds = new Set((existingMembers || []).map((row) => row.user_id));

  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: (users || []).filter((row) => !excludedIds.has(row.id)),
  });
}
