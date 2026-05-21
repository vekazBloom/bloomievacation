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

/** System admin only — edit per-fund annual days and project sick/religious totals on member profiles. */
export async function canEditMemberLeaveBalances(userId: string) {
  const profile = await getUserProfile(userId);
  return Boolean(profile?.is_system_admin);
}

/** Any project admin or system admin — used for global annual fund templates (shared across projects). */
export async function canManageGlobalAnnualFundDefinitions(userId: string) {
  const profile = await getUserProfile(userId);
  if (profile?.is_system_admin) return true;
  const { supabase } = await getAuthenticatedUser();
  const { count, error } = await supabase
    .from('project_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'admin');
  if (error) return false;
  return (count ?? 0) > 0;
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
