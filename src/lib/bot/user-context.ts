import {
  getUserProjectRoles,
  isSystemAdmin,
  getReviewableProjectIds,
} from '@/lib/projects/membership';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ProjectRole } from '@/types/database';

export type ToolTier = 'base' | 'team' | 'lead' | 'admin' | 'system';

export type UserBotCapabilities = {
  isSystemAdmin: boolean;
  projects: Array<{ projectId: string; name: string; slug: string; role: ProjectRole }>;
  reviewableProjectIds: string[];
  adminProjectIds: string[];
  tiers: Set<ToolTier>;
};

export async function getUserBotCapabilities(
  supabase: AppSupabase,
  userId: string
): Promise<UserBotCapabilities> {
  const [systemAdmin, projects, reviewableProjectIds] = await Promise.all([
    isSystemAdmin(supabase, userId),
    getUserProjectRoles(supabase, userId),
    getReviewableProjectIds(supabase, userId),
  ]);

  const adminProjectIds = projects
    .filter((p) => p.role === 'admin')
    .map((p) => p.projectId);

  const tiers = new Set<ToolTier>(['base', 'team']);
  if (reviewableProjectIds.length > 0) tiers.add('lead');
  if (systemAdmin || adminProjectIds.length > 0) tiers.add('admin');
  if (systemAdmin) tiers.add('system');

  return {
    isSystemAdmin: systemAdmin,
    projects,
    reviewableProjectIds,
    adminProjectIds,
    tiers,
  };
}

export async function buildUserContextBlock(supabase: AppSupabase, userId: string) {
  const caps = await getUserBotCapabilities(supabase, userId);
  const lines = caps.projects.map(
    (p) => `- ${p.name} (${p.role}): ${p.projectId}`
  );
  let block = `\n\nProjekti korisnika (koristi projectId):\n${lines.join('\n') || 'Nema aktivnih projekata.'}`;
  block += `\nSystem admin: ${caps.isSystemAdmin ? 'da' : 'ne'}`;
  if (caps.reviewableProjectIds.length > 0) {
    block += `\nMože odobravati zahtjeve u projektima: ${caps.reviewableProjectIds.join(', ')}`;
  }
  if (caps.adminProjectIds.length > 0) {
    block += `\nAdmin projekata: ${caps.adminProjectIds.join(', ')}`;
  }
  return block;
}
