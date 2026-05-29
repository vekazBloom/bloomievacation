import { unstable_cache } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { USER_PROFILE_CACHE_TAG } from '@/lib/auth/dashboard';
import {
  countIssues,
  getBoardSprints,
  getIssueWorklogs,
  getSprint,
  listIssueKeys,
  sumIssueTimespent,
  type JiraConnectionConfig,
} from '@/lib/jira/client';

type MappingRow = {
  app_user_id: string;
  app_user_email: string;
  jira_account_id: string;
  jira_display_name: string | null;
};

type SnapshotTotals = {
  scopeTotal: number;
  todoTotal: number;
  qaReadyTotal: number;
  qaRejectedTotal: number;
  doneTotal: number;
  completedTotal: number;
  carryOverTotal: number;
  completionRate: number;
};

type ProfileScope = { id: string; is_system_admin: boolean };
type JiraBoardConfig = { boardId: number; projectKey: string; label?: string | null };

type UserRow = {
  id: string;
  email: string;
  name: string | null;
};

function isMissingBoardConfigColumns(error: { message?: string; details?: string; code?: string } | null | undefined) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    text.includes('board_configs') ||
    text.includes('default_board_id')
  );
}

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function normalizeRequestedUserIds(
  requested: string[] | undefined,
  profile: ProfileScope
): string[] | null {
  if (!profile.is_system_admin) {
    return [profile.id];
  }
  if (!requested || requested.length === 0) return null;
  return dedupeIds(requested);
}

function formatIsoDateForJql(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function sumTrackedTimeForSprintWindow({
  config,
  projectKey,
  sprintId,
  jiraAccountId,
  sprintStart,
  sprintEnd,
  fallbackJql,
}: {
  config: JiraConnectionConfig;
  projectKey: string;
  sprintId: number;
  jiraAccountId: string;
  sprintStart: string | null | undefined;
  sprintEnd: string | null | undefined;
  fallbackJql: string;
}) {
  const startDate = formatIsoDateForJql(sprintStart);
  const endDate = formatIsoDateForJql(sprintEnd);
  if (!startDate || !endDate) {
    return sumIssueTimespent(config, `${fallbackJql} AND timespent > 0`);
  }

  const issueKeys = await listIssueKeys(
    config,
    `project = "${projectKey}" AND sprint = ${sprintId} AND assignee = ${jiraAccountId} AND worklogDate >= "${startDate}" AND worklogDate <= "${endDate}"`
  );
  if (issueKeys.length === 0) return 0;

  const startMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${endDate}T23:59:59.999Z`).getTime();

  const worklogsPerIssue = await Promise.all(
    issueKeys.map((issueKey) => getIssueWorklogs(config, issueKey))
  );

  let totalSeconds = 0;
  for (const worklogs of worklogsPerIssue) {
    for (const log of worklogs) {
      const startedMs = new Date(log.started).getTime();
      if (!Number.isNaN(startedMs) && startedMs >= startMs && startedMs <= endMs) {
        totalSeconds += Number(log.timeSpentSeconds || 0);
      }
    }
  }
  return totalSeconds;
}

export async function getAuthedProfile() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Reuse the same per-user cache as getDashboardSession so a single request
  // that hits both the dashboard layout and a Jira API route only reads the
  // profile row once.
  const { data: profile } = await unstable_cache(
    async () =>
      supabase
        .from('users')
        .select('id, email, is_system_admin')
        .eq('id', user.id)
        .maybeSingle(),
    [`user-profile-jira-${user.id}`],
    { revalidate: 60, tags: [USER_PROFILE_CACHE_TAG, `user-profile-${user.id}`] }
  )();

  if (!profile) return null;
  return { user, profile };
}

export async function getJiraConnection(): Promise<JiraConnectionConfig | null> {
  const raw = await getRawJiraConnection();
  if (!raw) return null;
  const boardConfigs = ((raw.board_configs || []) as JiraBoardConfig[]).filter(
    (row) => row && Number.isInteger(Number(row.boardId)) && typeof row.projectKey === 'string'
  );
  const defaultBoardId = Number(raw.default_board_id || raw.board_id);
  const defaultBoardConfig =
    boardConfigs.find((row) => Number(row.boardId) === defaultBoardId) || null;

  return {
    siteUrl: raw.site_url,
    jiraEmail: raw.jira_email,
    jiraApiToken: raw.jira_api_token,
    projectKey: defaultBoardConfig?.projectKey || raw.project_key,
    boardId: defaultBoardId,
  };
}

export async function getRawJiraConnection() {
  const service = createServiceClient() as any;
  const modern = await service
    .from('jira_connections')
    .select(
      'id, site_url, jira_email, jira_api_token, project_key, board_id, default_board_id, board_configs'
    )
    .limit(1)
    .maybeSingle();

  if (!modern.error && modern.data) return modern.data;
  if (!isMissingBoardConfigColumns(modern.error)) return null;

  const legacy = await service
    .from('jira_connections')
    .select('id, site_url, jira_email, jira_api_token, project_key, board_id')
    .limit(1)
    .maybeSingle();
  if (legacy.error || !legacy.data) return null;

  return {
    ...legacy.data,
    default_board_id: legacy.data.board_id,
    board_configs: [
      {
        boardId: Number(legacy.data.board_id),
        projectKey: legacy.data.project_key,
        label: `${legacy.data.project_key} board ${legacy.data.board_id}`,
      },
    ],
  };
}

export async function resolveJiraConnectionForProfile({
  profile,
  requestedBoardId,
}: {
  profile: ProfileScope;
  requestedBoardId?: number | null;
}): Promise<JiraConnectionConfig | null> {
  const raw = await getRawJiraConnection();
  if (!raw) return null;

  const configs = ((raw.board_configs || []) as JiraBoardConfig[]).filter(
    (row) => row && Number.isInteger(Number(row.boardId)) && typeof row.projectKey === 'string'
  );

  const defaultBoardId = Number(raw.default_board_id || raw.board_id);
  const allowedBoardIds = configs.map((row) => Number(row.boardId));
  const effectiveBoardId =
    profile.is_system_admin &&
    requestedBoardId &&
    Number.isInteger(requestedBoardId) &&
    requestedBoardId > 0 &&
    (allowedBoardIds.length === 0 || allowedBoardIds.includes(requestedBoardId))
      ? requestedBoardId
      : defaultBoardId;

  const selected = configs.find((row) => Number(row.boardId) === effectiveBoardId) || null;

  return {
    siteUrl: raw.site_url,
    jiraEmail: raw.jira_email,
    jiraApiToken: raw.jira_api_token,
    projectKey: selected?.projectKey || raw.project_key,
    boardId: effectiveBoardId,
  };
}

export async function getJiraUserMappings(): Promise<MappingRow[]> {
  const service = createServiceClient() as any;
  const { data } = await service
    .from('jira_user_mappings')
    .select('app_user_id, app_user_email, jira_account_id, jira_display_name')
    .order('app_user_email', { ascending: true });
  return (data || []) as MappingRow[];
}

export async function syncSprintMetrics({
  sprintId,
  syncedBy,
  profile,
  requestedBoardId,
}: {
  sprintId: number;
  syncedBy: string;
  profile: ProfileScope;
  requestedBoardId?: number | null;
}) {
  const config = await resolveJiraConnectionForProfile({ profile, requestedBoardId });
  if (!config) {
    throw new Error('Jira connection is not configured yet.');
  }
  const mappings = await getJiraUserMappings();
  const service = createServiceClient() as any;

  const sprint = await getSprint(config, sprintId);
  const baseJql = `project = "${config.projectKey}" AND sprint = ${sprintId}`;
  const doneTransitionJql = `${baseJql} AND status CHANGED TO "Done"`;

  const [scopeTotal, todoTotal, qaReadyTotal, qaRejectedTotal, doneTotal, completedTotal] =
    await Promise.all([
      countIssues(config, baseJql),
      countIssues(config, `${baseJql} AND status = "To Do"`),
      countIssues(config, `${baseJql} AND status = "QA READY"`),
      countIssues(config, `${baseJql} AND status = "QA REJECTED"`),
      countIssues(config, `${baseJql} AND status = "Done"`),
      countIssues(config, doneTransitionJql),
    ]);

  const carryOverTotal = Math.max(0, scopeTotal - completedTotal);
  const completionRate = scopeTotal > 0 ? completedTotal / scopeTotal : 0;

  const totals: SnapshotTotals = {
    scopeTotal,
    todoTotal,
    qaReadyTotal,
    qaRejectedTotal,
    doneTotal,
    completedTotal,
    carryOverTotal,
    completionRate,
  };

  await service.from('jira_sprint_snapshots').upsert(
    {
      board_id: config.boardId,
      sprint_id: sprint.id,
      sprint_name: sprint.name,
      sprint_state: sprint.state || 'unknown',
      sprint_start: sprint.startDate || null,
      sprint_end: sprint.endDate || null,
      sprint_complete: sprint.completeDate || null,
      snapshot_at: new Date().toISOString(),
      scope_total: totals.scopeTotal,
      completed_total: totals.completedTotal,
      carry_over_total: totals.carryOverTotal,
      completion_rate: totals.completionRate,
      todo_total: totals.todoTotal,
      qa_ready_total: totals.qaReadyTotal,
      qa_rejected_total: totals.qaRejectedTotal,
      done_total: totals.doneTotal,
      synced_by: syncedBy,
    },
    { onConflict: 'board_id,sprint_id' }
  );

  // Fetch all per-user metrics in parallel, then batch-upsert in one DB call.
  const sprintEndForWindow = sprint.endDate || sprint.completeDate || null;
  const userMetricRecords = await Promise.all(
    mappings.map(async (mapping) => {
      const assigneeJql = `${baseJql} AND assignee = ${mapping.jira_account_id}`;
      const [issueCount, qaReadyToDoneCount, qaReadyToRejectedCount, trackedTimeSeconds, doneKeys, rejectedKeys] =
        await Promise.all([
          countIssues(config, assigneeJql),
          countIssues(config, `${assigneeJql} AND status CHANGED FROM "QA READY" TO "Done"`),
          countIssues(config, `${assigneeJql} AND status CHANGED FROM "QA READY" TO "QA REJECTED"`),
          sumTrackedTimeForSprintWindow({
            config,
            projectKey: config.projectKey,
            sprintId,
            jiraAccountId: mapping.jira_account_id,
            sprintStart: sprint.startDate || null,
            sprintEnd: sprintEndForWindow,
            fallbackJql: assigneeJql,
          }),
          listIssueKeys(config, `${assigneeJql} AND status CHANGED FROM "QA READY" TO "Done"`),
          listIssueKeys(config, `${assigneeJql} AND status CHANGED FROM "QA READY" TO "QA REJECTED"`),
        ]);

      const doneSet = new Set(doneKeys);
      const rejectedSet = new Set(rejectedKeys);
      let bothTransitionsCount = 0;
      for (const key of doneSet) {
        if (rejectedSet.has(key)) bothTransitionsCount += 1;
      }
      const doneOnlyCount = Math.max(0, doneSet.size - bothTransitionsCount);

      return {
        board_id: config.boardId,
        sprint_id: sprint.id,
        app_user_id: mapping.app_user_id,
        jira_account_id: mapping.jira_account_id,
        jira_display_name: mapping.jira_display_name,
        issue_count: issueCount,
        qa_ready_to_done_count: qaReadyToDoneCount,
        qa_ready_to_rejected_count: qaReadyToRejectedCount,
        qa_ready_done_only_count: doneOnlyCount,
        qa_ready_both_transitions_count: bothTransitionsCount,
        tracked_time_seconds: trackedTimeSeconds,
      };
    })
  );

  if (userMetricRecords.length > 0) {
    await service
      .from('jira_sprint_user_metrics')
      .upsert(userMetricRecords, { onConflict: 'board_id,sprint_id,app_user_id' });
  }

  const { data: snapshot } = await service
    .from('jira_sprint_snapshots')
    .select('*')
    .eq('board_id', config.boardId)
    .eq('sprint_id', sprintId)
    .maybeSingle();

  return snapshot;
}

export async function getUserSprintMetrics(
  sprintId: number,
  profile: { id: string; is_system_admin: boolean },
  requestedBoardId?: number | null
) {
  const service = createServiceClient() as any;
  const config = await resolveJiraConnectionForProfile({ profile, requestedBoardId });
  if (!config) return { snapshot: null, userMetrics: [] as any[] };

  const { data: snapshot } = await service
    .from('jira_sprint_snapshots')
    .select('*')
    .eq('board_id', config.boardId)
    .eq('sprint_id', sprintId)
    .maybeSingle();

  let query = service
    .from('jira_sprint_user_metrics')
    .select('*')
    .eq('board_id', config.boardId)
    .eq('sprint_id', sprintId)
    .order('tracked_time_seconds', { ascending: false });

  if (!profile.is_system_admin) {
    query = query.eq('app_user_id', profile.id);
  }

  const { data: userMetrics } = await query;
  const metrics = (userMetrics || []) as Array<{
    app_user_id: string;
    [key: string]: unknown;
  }>;
  const userIds = metrics.map((row) => row.app_user_id);

  const { data: users } = userIds.length
    ? await service.from('users').select('id, email, name').in('id', userIds)
    : { data: [] };

  const usersById = new Map((users || []).map((u: any) => [u.id, u]));
  const merged = metrics.map((row) => ({
    ...row,
    users: usersById.get(row.app_user_id) || null,
  }));

  return { snapshot, userMetrics: merged };
}

export async function listBoardSprintsWithSync({
  profile,
  requestedBoardId,
}: {
  profile: ProfileScope;
  requestedBoardId?: number | null;
}) {
  const config = await resolveJiraConnectionForProfile({ profile, requestedBoardId });
  if (!config) return [];
  const sprints = await getBoardSprints(config);
  const service = createServiceClient() as any;
  const sprintIds = sprints.map((s) => s.id);

  const { data: snapshots } = sprintIds.length
    ? await service
        .from('jira_sprint_snapshots')
        .select('sprint_id, snapshot_at')
        .eq('board_id', config.boardId)
        .in('sprint_id', sprintIds)
    : { data: [] };

  const bySprintId = new Map<number, string>(
    (snapshots || []).map((row: any) => [Number(row.sprint_id), row.snapshot_at])
  );

  return sprints
    .map((s) => {
      const lastSyncedAt = bySprintId.get(Number(s.id)) ?? null;
      return {
        id: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
        completeDate: s.completeDate ?? null,
        isSynced: Boolean(lastSyncedAt),
        lastSyncedAt,
        lastSyncState: lastSyncedAt ? 'synced' : 'not_synced',
        canSync: profile.is_system_admin,
      };
    })
    .sort((a, b) => b.id - a.id);
}

async function fetchUsersByIds(service: any, userIds: string[]) {
  if (userIds.length === 0) return [] as UserRow[];
  const { data } = await service.from('users').select('id, email, name').in('id', userIds);
  return (data || []) as UserRow[];
}

export async function getSprintComparisonData({
  sprintIds,
  profile,
  requestedBoardId,
}: {
  sprintIds: number[];
  profile: ProfileScope;
  requestedBoardId?: number | null;
}) {
  const config = await resolveJiraConnectionForProfile({ profile, requestedBoardId });
  if (!config) return { snapshots: [], userTotals: [] as any[] };
  const service = createServiceClient() as any;

  const { data: snapshots } = await service
    .from('jira_sprint_snapshots')
    .select('*')
    .eq('board_id', config.boardId)
    .in('sprint_id', sprintIds)
    .order('sprint_id', { ascending: true });

  let metricsQuery = service
    .from('jira_sprint_user_metrics')
    .select('*')
    .eq('board_id', config.boardId)
    .in('sprint_id', sprintIds);

  if (!profile.is_system_admin) {
    metricsQuery = metricsQuery.eq('app_user_id', profile.id);
  }

  const { data: metrics } = await metricsQuery;
  const metricRows = (metrics || []) as any[];
  const userIds = dedupeIds(metricRows.map((row) => row.app_user_id));
  const users = await fetchUsersByIds(service, userIds);
  const usersById = new Map(users.map((u) => [u.id, u]));

  const userTotals = userIds.map((userId) => {
    const rows = metricRows.filter((row) => row.app_user_id === userId);
    return {
      appUserId: userId,
      userName: usersById.get(userId)?.name || usersById.get(userId)?.email || 'User',
      userEmail: usersById.get(userId)?.email || null,
      issueCount: rows.reduce((sum, row) => sum + Number(row.issue_count || 0), 0),
      qaReadyToDoneCount: rows.reduce((sum, row) => sum + Number(row.qa_ready_to_done_count || 0), 0),
      qaReadyToRejectedCount: rows.reduce(
        (sum, row) => sum + Number(row.qa_ready_to_rejected_count || 0),
        0
      ),
      trackedTimeSeconds: rows.reduce((sum, row) => sum + Number(row.tracked_time_seconds || 0), 0),
    };
  });

  return { snapshots: snapshots || [], userTotals };
}

export async function getUserComparisonData({
  sprintIds,
  requestedUserIds,
  profile,
  requestedBoardId,
}: {
  sprintIds: number[];
  requestedUserIds?: string[];
  profile: ProfileScope;
  requestedBoardId?: number | null;
}) {
  const config = await resolveJiraConnectionForProfile({ profile, requestedBoardId });
  if (!config) return { rows: [] as any[] };
  const service = createServiceClient() as any;

  const normalizedUserIds = normalizeRequestedUserIds(requestedUserIds, profile);
  let query = service
    .from('jira_sprint_user_metrics')
    .select('*')
    .eq('board_id', config.boardId)
    .in('sprint_id', sprintIds)
    .order('sprint_id', { ascending: true });

  if (normalizedUserIds && normalizedUserIds.length > 0) {
    query = query.in('app_user_id', normalizedUserIds);
  }

  const { data: rows } = await query;
  const metrics = (rows || []) as any[];
  const userIds = dedupeIds(metrics.map((row) => row.app_user_id));
  const users = await fetchUsersByIds(service, userIds);
  const usersById = new Map(users.map((u) => [u.id, u]));

  const { data: snapshots } = await service
    .from('jira_sprint_snapshots')
    .select(
      'sprint_id, sprint_name, sprint_state, snapshot_at, scope_total, completed_total, carry_over_total, completion_rate'
    )
    .eq('board_id', config.boardId)
    .in('sprint_id', sprintIds);

  const snapshotsBySprintId = new Map<number, any>(
    (snapshots || []).map((row: any) => [Number(row.sprint_id), row])
  );

  return {
    rows: metrics.map((row) => {
      const user = usersById.get(row.app_user_id);
      const sprint = snapshotsBySprintId.get(Number(row.sprint_id));
      return {
        sprintId: row.sprint_id,
        sprintName: sprint?.sprint_name || `Sprint ${row.sprint_id}`,
        sprintState: sprint?.sprint_state || 'unknown',
        snapshotAt: sprint?.snapshot_at || null,
        appUserId: row.app_user_id,
        userName: user?.name || user?.email || row.jira_display_name || 'User',
        userEmail: user?.email || null,
        jiraAccountId: row.jira_account_id,
        issueCount: Number(row.issue_count || 0),
        qaReadyToDoneCount: Number(row.qa_ready_to_done_count || 0),
        qaReadyToRejectedCount: Number(row.qa_ready_to_rejected_count || 0),
        trackedTimeSeconds: Number(row.tracked_time_seconds || 0),
        scopeTotal: Number(sprint?.scope_total || 0),
        completedTotal: Number(sprint?.completed_total || 0),
        carryOverTotal: Number(sprint?.carry_over_total || 0),
        completionRate: Number(sprint?.completion_rate || 0),
      };
    }),
  };
}
