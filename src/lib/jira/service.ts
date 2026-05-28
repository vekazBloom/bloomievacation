import { createClient, createServiceClient } from '@/lib/supabase/server';
import { countIssues, getSprint, sumIssueTimespent, type JiraConnectionConfig } from '@/lib/jira/client';

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

export async function getAuthedProfile() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, is_system_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  return { user, profile };
}

export async function getJiraConnection(): Promise<JiraConnectionConfig | null> {
  const service = createServiceClient() as any;
  const { data, error } = await service
    .from('jira_connections')
    .select('site_url, jira_email, jira_api_token, project_key, board_id')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    siteUrl: data.site_url,
    jiraEmail: data.jira_email,
    jiraApiToken: data.jira_api_token,
    projectKey: data.project_key,
    boardId: Number(data.board_id),
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
}: {
  sprintId: number;
  syncedBy: string;
}) {
  const config = await getJiraConnection();
  if (!config) {
    throw new Error('Jira connection is not configured yet.');
  }
  const mappings = await getJiraUserMappings();
  const service = createServiceClient() as any;

  const sprint = await getSprint(config, sprintId);
  const baseJql = `project = "${config.projectKey}" AND sprint = ${sprintId}`;
  const doneTransitionJql = `${baseJql} AND status CHANGED TO "DONE"`;

  const [scopeTotal, todoTotal, qaReadyTotal, qaRejectedTotal, doneTotal, completedTotal] =
    await Promise.all([
      countIssues(config, baseJql),
      countIssues(config, `${baseJql} AND status = "To Do"`),
      countIssues(config, `${baseJql} AND status = "QA READY"`),
      countIssues(config, `${baseJql} AND status = "QA REJECTED"`),
      countIssues(config, `${baseJql} AND status = "DONE"`),
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

  for (const mapping of mappings) {
    const assigneeJql = `${baseJql} AND assignee = ${mapping.jira_account_id}`;
    const [issueCount, qaReadyToDoneCount, qaReadyToRejectedCount, trackedTimeSeconds] =
      await Promise.all([
        countIssues(config, assigneeJql),
        countIssues(
          config,
          `${assigneeJql} AND status CHANGED FROM "QA READY" TO "DONE"`
        ),
        countIssues(
          config,
          `${assigneeJql} AND status CHANGED FROM "QA READY" TO "QA REJECTED"`
        ),
        sumIssueTimespent(config, assigneeJql),
      ]);

    await service.from('jira_sprint_user_metrics').upsert(
      {
        board_id: config.boardId,
        sprint_id: sprint.id,
        app_user_id: mapping.app_user_id,
        jira_account_id: mapping.jira_account_id,
        jira_display_name: mapping.jira_display_name,
        issue_count: issueCount,
        qa_ready_to_done_count: qaReadyToDoneCount,
        qa_ready_to_rejected_count: qaReadyToRejectedCount,
        tracked_time_seconds: trackedTimeSeconds,
      },
      { onConflict: 'board_id,sprint_id,app_user_id' }
    );
  }

  const { data: snapshot } = await service
    .from('jira_sprint_snapshots')
    .select('*')
    .eq('board_id', config.boardId)
    .eq('sprint_id', sprintId)
    .maybeSingle();

  return snapshot;
}

export async function getUserSprintMetrics(sprintId: number, profile: { id: string; is_system_admin: boolean }) {
  const service = createServiceClient() as any;
  const config = await getJiraConnection();
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
