import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUserLeaveTotals } from '@/lib/leave/global-balance';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { createServiceClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

const updateSchema = z.object({
  role: z.enum(['admin', 'lead', 'employee']).optional(),
  annual_leave_total: z.number().int().min(0).optional(),
  sick_leave_total: z.number().int().min(0).optional(),
  religious_leave_total: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
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

  const { data, error } = await supabase
    .from('project_members')
    .update({
      ...parsed.data,
      role: parsed.data.role as ProjectRole | undefined,
    })
    .eq('id', params.memberId)
    .eq('project_id', project.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (
    parsed.data.annual_leave_total !== undefined ||
    parsed.data.sick_leave_total !== undefined ||
    parsed.data.religious_leave_total !== undefined
  ) {
    const service = createServiceClient();
    const syncResult = await syncUserLeaveTotals(service, data.user_id, {
      annual_leave_total: parsed.data.annual_leave_total,
      sick_leave_total: parsed.data.sick_leave_total,
      religious_leave_total: parsed.data.religious_leave_total,
    });
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ member: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string; memberId: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', params.memberId)
    .eq('project_id', project.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
