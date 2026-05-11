import { createClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getUserProfile(userId: string) {
  const supabase = createClient();
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function getProjectMembership(projectId: string, userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function canManageProject(projectId: string, userId: string) {
  const profile = await getUserProfile(userId);
  if (profile?.is_system_admin) return true;
  const membership = await getProjectMembership(projectId, userId);
  return membership?.role === 'admin';
}

export async function canReviewLeave(projectId: string, userId: string) {
  const profile = await getUserProfile(userId);
  if (profile?.is_system_admin) return true;
  const membership = await getProjectMembership(projectId, userId);
  return membership?.role === 'admin' || membership?.role === 'lead';
}

export function isLeadRole(role: ProjectRole | null | undefined) {
  return role === 'admin' || role === 'lead';
}

export function canReviewLeaveForRole(
  isSystemAdmin: boolean | null | undefined,
  role: ProjectRole | null | undefined
) {
  if (isSystemAdmin) return true;
  return role === 'admin' || role === 'lead';
}
