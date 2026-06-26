import { isSystemAdmin } from '@/lib/projects/membership';
import {
  getJiraConnection,
  getUserSprintMetrics,
  listBoardSprintsWithSync,
} from '@/lib/jira/service';
import type { AppSupabase } from '@/lib/supabase/app-client';

async function requireSystemAdmin(supabase: AppSupabase, userId: string) {
  if (!(await isSystemAdmin(supabase, userId))) {
    return { ok: false as const, error: 'Samo system admin ima pristup Jira podacima.', status: 403 };
  }
  return { ok: true as const };
}

export async function getJiraConfigSummary(supabase: AppSupabase, userId: string) {
  const gate = await requireSystemAdmin(supabase, userId);
  if (!gate.ok) return gate;

  const config = await getJiraConnection();
  if (!config) {
    return { ok: true as const, connected: false as const, config: null };
  }

  return {
    ok: true as const,
    connected: true as const,
    config: {
      siteUrl: config.siteUrl,
      projectKey: config.projectKey,
      boardId: config.boardId,
    },
  };
}

export async function listJiraSprints(supabase: AppSupabase, userId: string, boardId?: number) {
  const gate = await requireSystemAdmin(supabase, userId);
  if (!gate.ok) return gate;

  const { data: profile } = await supabase
    .from('users')
    .select('id, is_system_admin')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { ok: false as const, error: 'Profil nije pronađen.', status: 404 };

  const sprints = await listBoardSprintsWithSync({
    profile: { id: profile.id, is_system_admin: Boolean(profile.is_system_admin) },
    requestedBoardId: boardId ?? null,
  });

  return {
    ok: true as const,
    sprints: sprints.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      isSynced: s.isSynced,
      lastSyncedAt: s.lastSyncedAt,
    })),
  };
}

export async function getJiraSprintAnalytics(
  supabase: AppSupabase,
  userId: string,
  sprintId: number,
  boardId?: number
) {
  const gate = await requireSystemAdmin(supabase, userId);
  if (!gate.ok) return gate;

  const { data: profile } = await supabase
    .from('users')
    .select('id, is_system_admin')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { ok: false as const, error: 'Profil nije pronađen.', status: 404 };

  const { snapshot, userMetrics } = await getUserSprintMetrics(sprintId, profile, boardId ?? null);

  return {
    ok: true as const,
    snapshot: snapshot
      ? {
          sprintName: (snapshot as { sprint_name?: string }).sprint_name,
          snapshotAt: (snapshot as { snapshot_at?: string }).snapshot_at,
        }
      : null,
    userMetrics: (userMetrics || []).map((row: Record<string, unknown>) => ({
      userName: (row.users as { name?: string } | null)?.name ?? 'Korisnik',
      issuesCompleted: row.issues_completed,
      issuesTotal: row.issues_total,
      trackedTimeSeconds: row.tracked_time_seconds,
    })),
  };
}
