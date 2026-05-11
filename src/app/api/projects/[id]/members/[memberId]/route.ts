import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import type { ProjectRole } from '@/types/database';

const updateSchema = z.object({
  role: z.enum(['admin', 'lead', 'employee']).optional(),
  annual_leave_total: z.number().int().min(0).optional(),
  sick_leave_total: z.number().int().min(0).optional(),
  religious_leave_total: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const allowed = await canManageProject(params.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data, error } = await supabase
    .from('project_members')
    .update({
      ...parsed.data,
      role: parsed.data.role as ProjectRole | undefined,
    })
    .eq('id', params.memberId)
    .eq('project_id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const allowed = await canManageProject(params.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', params.memberId)
    .eq('project_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
