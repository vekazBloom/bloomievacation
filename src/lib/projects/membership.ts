import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ProjectRole } from '@/types/database';

export type UserProjectRole = {
  projectId: string;
  slug: string;
  name: string;
  role: ProjectRole;
};

type PermResult = { ok: true } | { ok: false; error: string; status: number };

export async function getUserProjectRoles(
  supabase: AppSupabase,
  userId: string
): Promise<UserProjectRole[]> {
  const { data } = await supabase
    .from('project_members')
    .select('role, projects(id, slug, name, is_archived)')
    .eq('user_id', userId);

  return (data || [])
    .map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      if (!project?.id || project.is_archived) return null;
      return {
        projectId: project.id as string,
        slug: (project.slug as string) ?? '',
        name: project.name as string,
        role: row.role as ProjectRole,
      };
    })
    .filter((row): row is UserProjectRole => Boolean(row));
}

export async function isSystemAdmin(supabase: AppSupabase, userId: string) {
  const { data } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data?.is_system_admin);
}

export async function canUserReviewProject(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  if (await isSystemAdmin(supabase, userId)) return true;
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();
  return data?.role === 'admin' || data?.role === 'lead';
}

export async function getReviewableProjectIds(supabase: AppSupabase, userId: string) {
  if (await isSystemAdmin(supabase, userId)) {
    const roles = await getUserProjectRoles(supabase, userId);
    if (roles.length > 0) return roles.map((r) => r.projectId);
    const { data: projects } = await supabase.from('projects').select('id').eq('is_archived', false);
    return (projects || []).map((p) => p.id);
  }
  const roles = await getUserProjectRoles(supabase, userId);
  return roles.filter((r) => r.role === 'admin' || r.role === 'lead').map((r) => r.projectId);
}

export async function assertProjectMember(
  supabase: AppSupabase,
  userId: string,
  projectId: string
): Promise<PermResult> {
  const roles = await getUserProjectRoles(supabase, userId);
  if (!roles.some((r) => r.projectId === projectId)) {
    return { ok: false, error: 'Niste član ovog projekta.', status: 403 };
  }
  return { ok: true };
}

export async function assertCanReview(
  supabase: AppSupabase,
  userId: string,
  projectId: string
): Promise<PermResult> {
  const memberCheck = await assertProjectMember(supabase, userId, projectId);
  if (!memberCheck.ok) return memberCheck;
  if (!(await canUserReviewProject(supabase, userId, projectId))) {
    return { ok: false, error: 'Nemate dozvolu za odobravanje u ovom projektu.', status: 403 };
  }
  return { ok: true };
}

export async function isProjectAdmin(supabase: AppSupabase, userId: string, projectId: string) {
  if (await isSystemAdmin(supabase, userId)) return true;
  const roles = await getUserProjectRoles(supabase, userId);
  return roles.some((p) => p.projectId === projectId && p.role === 'admin');
}
