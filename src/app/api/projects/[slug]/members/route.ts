import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUserLeaveTotals } from '@/lib/leave/global-balance';
import { sendProjectAddedEmail } from '@/lib/email/send';
import { closePendingInvitationsForEmail } from '@/lib/invitations/status';
import { createInAppNotification } from '@/lib/notifications/in-app';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { createServiceClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

const addSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'lead', 'employee']).default('employee'),
  annual_leave_total: z.number().int().min(0).optional(),
  sick_leave_total: z.number().int().min(0).optional(),
  religious_leave_total: z.number().int().min(0).optional(),
});

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
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { userId, role, annual_leave_total, sick_leave_total, religious_leave_total } =
    parsed.data;

  const { data: addedUser } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', userId)
    .maybeSingle();

  if (!addedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { data: member, error } = await supabase
    .from('project_members')
    .upsert(
      {
        project_id: project.id,
        user_id: userId,
        role: role as ProjectRole,
        annual_leave_total,
        sick_leave_total,
        religious_leave_total,
      },
      { onConflict: 'project_id,user_id' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (
    annual_leave_total !== undefined ||
    sick_leave_total !== undefined ||
    religious_leave_total !== undefined
  ) {
    const syncResult = await syncUserLeaveTotals(supabase, userId, {
      annual_leave_total,
      sick_leave_total,
      religious_leave_total,
    });
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
    }
  }

  const { data: actor } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  const service = createServiceClient();

  if (addedUser.email) {
    await closePendingInvitationsForEmail(service, project.id, addedUser.email);
  }

  await createInAppNotification(service, {
    userId,
    type: 'project_added',
    title: `Added to ${project.name}`,
    message: `${actor?.name || 'An admin'} added you to the project.`,
    link: projectPath(project.slug),
  });

  if (addedUser.email) {
    await sendProjectAddedEmail({
      to: addedUser.email,
      recipientName: addedUser.name,
      projectName: project.name,
      addedByName: actor?.name || 'Your team',
      projectSlug: project.slug,
    });
  }

  return NextResponse.json({ member });
}
