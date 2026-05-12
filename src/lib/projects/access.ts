import { cache } from 'react';
import { getAuthenticatedUser } from '@/lib/auth/dashboard';
import type { ProjectRole } from '@/types/database';

export const getCurrentUser = getAuthenticatedUser;

export const getUserProfile = cache(async (userId: string) => {
  const { supabase } = await getAuthenticatedUser();
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  return data;
});

export const getProjectMembership = cache(async (projectId: string, userId: string) => {
  const { supabase } = await getAuthenticatedUser();
  const { data } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
});

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
