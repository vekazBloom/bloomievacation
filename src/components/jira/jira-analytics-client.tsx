'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Sprint = {
  id: number;
  name: string;
  state: string;
  isSynced: boolean;
  lastSyncedAt: string | null;
  lastSyncState: 'synced' | 'not_synced';
};

type Snapshot = {
  sprint_id?: number;
  sprint_name?: string;
  sprint_state?: string;
  scope_total: number;
  completed_total: number;
  carry_over_total: number;
  completion_rate: number;
  todo_total: number;
  qa_ready_total: number;
  qa_rejected_total: number;
  done_total: number;
  snapshot_at: string;
};

type MetricRow = {
  app_user_id: string;
  jira_account_id: string;
  jira_display_name: string | null;
  issue_count: number;
  qa_ready_to_done_count: number;
  qa_ready_to_rejected_count: number;
  tracked_time_seconds: number;
  users?: { name?: string | null; email?: string | null };
};

type Mapping = {
  app_user_id: string;
  app_user_email: string;
  jira_account_id: string;
  jira_display_name: string | null;
};

type AppUser = { id: string; email: string; name: string };

type CompareSprintPayload = {
  snapshots: Snapshot[];
  userTotals: Array<{
    appUserId: string;
    userName: string;
    userEmail: string | null;
    issueCount: number;
    qaReadyToDoneCount: number;
    qaReadyToRejectedCount: number;
    trackedTimeSeconds: number;
  }>;
};

type CompareUserRow = {
  sprintId: number;
  sprintName: string;
  sprintState: string;
  snapshotAt: string | null;
  appUserId: string;
  userName: string;
  userEmail: string | null;
  jiraAccountId: string;
  issueCount: number;
  qaReadyToDoneCount: number;
  qaReadyToRejectedCount: number;
  trackedTimeSeconds: number;
  scopeTotal: number;
  completedTotal: number;
  carryOverTotal: number;
  completionRate: number;
};

function formatSeconds(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function stateBadgeClass(state: string) {
  if (state === 'active') return 'bg-emerald-100 text-emerald-800';
  if (state === 'closed') return 'bg-slate-200 text-slate-700';
  if (state === 'future') return 'bg-amber-100 text-amber-800';
  return 'bg-muted text-muted-foreground';
}

export function JiraAnalyticsClient({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [siteUrl, setSiteUrl] = useState('');
  const [projectKey, setProjectKey] = useState('GO');
  const [boardId, setBoardId] = useState('166');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingUserId, setMappingUserId] = useState('');
  const [mappingAccountId, setMappingAccountId] = useState('');
  const [mappingDisplayName, setMappingDisplayName] = useState('');
  const [selectedComparisonSprintIds, setSelectedComparisonSprintIds] = useState<number[]>([]);
  const [selectedComparisonUserIds, setSelectedComparisonUserIds] = useState<string[]>([]);
  const [compareSprintsData, setCompareSprintsData] = useState<CompareSprintPayload>({
    snapshots: [],
    userTotals: [],
  });
  const [compareUsersRows, setCompareUsersRows] = useState<CompareUserRow[]>([]);
  const [comparing, setComparing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const selectedSprint = useMemo(
    () => sprints.find((s) => s.id === selectedSprintId) || null,
    [sprints, selectedSprintId]
  );

  async function loadSprints() {
    setLoadingSprints(true);
    const response = await fetch('/api/jira/sprints');
    const payload = await response.json().catch(() => ({}));
    setLoadingSprints(false);
    if (!response.ok) {
      if (payload.error) toast.error(payload.error);
      return;
    }
    setSprints(payload.sprints || []);
    if (payload.sprints?.length) {
      if (!selectedSprintId) {
        setSelectedSprintId(payload.sprints[0].id);
      }
      setSelectedComparisonSprintIds((current) => {
        if (current.length > 0) return current;
        return payload.sprints.slice(0, 2).map((s: Sprint) => s.id);
      });
    }
  }

  async function loadAnalytics(sprintId: number) {
    setLoadingAnalytics(true);
    const response = await fetch(`/api/jira/analytics?sprintId=${sprintId}`);
    const payload = await response.json().catch(() => ({}));
    setLoadingAnalytics(false);
    if (!response.ok) {
      if (payload.error) toast.error(payload.error);
      return;
    }
    setSnapshot(payload.snapshot || null);
    setMetrics(payload.userMetrics || []);
  }

  async function runSync() {
    if (!selectedSprintId) return;
    setSyncing(true);
    const response = await fetch('/api/jira/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId: selectedSprintId }),
    });
    const payload = await response.json().catch(() => ({}));
    setSyncing(false);
    if (!response.ok) {
      return toast.error(payload.error || 'Sync failed');
    }
    toast.success('Sprint synced successfully');
    await loadAnalytics(selectedSprintId);
    await loadSprints();
  }

  async function loadConfigAndMappings() {
    if (!isSystemAdmin) return;

    const [configRes, usersRes, mappingRes] = await Promise.all([
      fetch('/api/jira/config'),
      fetch('/api/jira/users'),
      fetch('/api/jira/mappings'),
    ]);

    const [configPayload, usersPayload, mappingPayload] = await Promise.all([
      configRes.json().catch(() => ({})),
      usersRes.json().catch(() => ({})),
      mappingRes.json().catch(() => ({})),
    ]);

    if (configRes.ok && configPayload.config) {
      setSiteUrl(configPayload.config.siteUrl || '');
      setProjectKey(configPayload.config.projectKey || 'GO');
      setBoardId(String(configPayload.config.boardId || 166));
      setJiraEmail(configPayload.config.jiraEmail || '');
    }
    if (usersRes.ok) setUsers(usersPayload.users || []);
    if (mappingRes.ok) setMappings(mappingPayload.mappings || []);
  }

  async function saveConfig() {
    setSavingConfig(true);
    const response = await fetch('/api/jira/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteUrl,
        projectKey,
        boardId: Number(boardId),
        jiraEmail,
        jiraApiToken,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSavingConfig(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to save config');
    toast.success('Jira config saved');
    setJiraApiToken('');
    await loadSprints();
  }

  async function addMapping() {
    const response = await fetch('/api/jira/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appUserId: mappingUserId,
        jiraAccountId: mappingAccountId,
        jiraDisplayName: mappingDisplayName || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || 'Failed to save mapping');
    toast.success('Delegation mapping saved');
    setMappingAccountId('');
    setMappingDisplayName('');
    const refreshed = await fetch('/api/jira/mappings');
    const refreshedPayload = await refreshed.json().catch(() => ({}));
    if (refreshed.ok) setMappings(refreshedPayload.mappings || []);
  }

  async function runComparison() {
    if (selectedComparisonSprintIds.length === 0) {
      return toast.error('Select at least one sprint');
    }
    setComparing(true);
    const sprintIdsParam = selectedComparisonSprintIds.join(',');
    const userIdsParam = selectedComparisonUserIds.join(',');

    const [sprintRes, userRes] = await Promise.all([
      fetch(`/api/jira/analytics/compare-sprints?sprintIds=${encodeURIComponent(sprintIdsParam)}`),
      fetch(
        `/api/jira/analytics/compare-users?sprintIds=${encodeURIComponent(sprintIdsParam)}${
          userIdsParam ? `&userIds=${encodeURIComponent(userIdsParam)}` : ''
        }`
      ),
    ]);

    const [sprintPayload, userPayload] = await Promise.all([
      sprintRes.json().catch(() => ({})),
      userRes.json().catch(() => ({})),
    ]);
    setComparing(false);

    if (!sprintRes.ok) return toast.error(sprintPayload.error || 'Failed to compare sprints');
    if (!userRes.ok) return toast.error(userPayload.error || 'Failed to compare users');

    setCompareSprintsData({
      snapshots: sprintPayload.snapshots || [],
      userTotals: sprintPayload.userTotals || [],
    });
    setCompareUsersRows(userPayload.rows || []);
  }

  async function exportCsv() {
    if (selectedComparisonSprintIds.length === 0) {
      return toast.error('Select at least one sprint for export');
    }
    setExportingCsv(true);
    const sprintIdsParam = selectedComparisonSprintIds.join(',');
    const userIdsParam = selectedComparisonUserIds.join(',');
    const url = `/api/jira/analytics/export?sprintIds=${encodeURIComponent(sprintIdsParam)}${
      userIdsParam ? `&userIds=${encodeURIComponent(userIdsParam)}` : ''
    }`;

    const response = await fetch(url);
    setExportingCsv(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return toast.error(payload.error || 'CSV export failed');
    }
    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = `jira-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(fileUrl);
  }

  function toggleComparisonSprint(sprintId: number) {
    setSelectedComparisonSprintIds((current) => {
      if (current.includes(sprintId)) return current.filter((id) => id !== sprintId);
      if (current.length >= 8) {
        toast.error('You can compare up to 8 sprints');
        return current;
      }
      return [...current, sprintId];
    });
  }

  function toggleComparisonUser(userId: string) {
    setSelectedComparisonUserIds((current) => {
      if (current.includes(userId)) return current.filter((id) => id !== userId);
      if (current.length >= 20) {
        toast.error('You can compare up to 20 users');
        return current;
      }
      return [...current, userId];
    });
  }

  useEffect(() => {
    void loadSprints();
    void loadConfigAndMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSprintId) void loadAnalytics(selectedSprintId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSprintId]);

  useEffect(() => {
    if (selectedComparisonSprintIds.length > 0) {
      void runComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sprintChartData = useMemo(
    () =>
      (compareSprintsData.snapshots || []).map((row) => ({
        sprint: row.sprint_name || `#${row.sprint_id}`,
        scope: Number(row.scope_total || 0),
        completed: Number(row.completed_total || 0),
        carryOver: Number(row.carry_over_total || 0),
        completionRate: Math.round(Number(row.completion_rate || 0) * 100),
      })),
    [compareSprintsData.snapshots]
  );

  const userAggregateData = useMemo(() => {
    const map = new Map<
      string,
      {
        userName: string;
        tickets: number;
        qaDone: number;
        qaRejected: number;
        trackedHours: number;
      }
    >();
    for (const row of compareUsersRows) {
      const current = map.get(row.appUserId) || {
        userName: row.userName,
        tickets: 0,
        qaDone: 0,
        qaRejected: 0,
        trackedHours: 0,
      };
      current.tickets += Number(row.issueCount || 0);
      current.qaDone += Number(row.qaReadyToDoneCount || 0);
      current.qaRejected += Number(row.qaReadyToRejectedCount || 0);
      current.trackedHours += Number(row.trackedTimeSeconds || 0) / 3600;
      map.set(row.appUserId, current);
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, trackedHours: Number(row.trackedHours.toFixed(2)) }))
      .sort((a, b) => b.trackedHours - a.trackedHours);
  }, [compareUsersRows]);

  const comparisonUsers = useMemo(() => {
    if (!isSystemAdmin) return [] as AppUser[];
    return users;
  }, [isSystemAdmin, users]);

  return (
    <div className="space-y-6">
      {isSystemAdmin ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg">Jira Connection</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Site URL</Label>
                <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Project key</Label>
                <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Board ID</Label>
                <Input value={boardId} onChange={(e) => setBoardId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jira email</Label>
                <Input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Jira API token</Label>
                <Input
                  type="password"
                  value={jiraApiToken}
                  onChange={(e) => setJiraApiToken(e.target.value)}
                  placeholder="Enter token only when changing it"
                />
              </div>
            </div>
            <Button onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? 'Saving...' : 'Save Jira config'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isSystemAdmin ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg">Admin Delegation (App User → Jira accountId)</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-input bg-card px-3 text-sm"
                value={mappingUserId}
                onChange={(e) => setMappingUserId(e.target.value)}
              >
                <option value="">Select app user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Jira accountId"
                value={mappingAccountId}
                onChange={(e) => setMappingAccountId(e.target.value)}
              />
              <Input
                placeholder="Jira display name (optional)"
                value={mappingDisplayName}
                onChange={(e) => setMappingDisplayName(e.target.value)}
              />
              <Button onClick={addMapping} disabled={!mappingUserId || !mappingAccountId}>
                Save mapping
              </Button>
            </div>

            <div className="space-y-2">
              {mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delegation mappings yet.</p>
              ) : (
                mappings.map((mapping) => (
                  <div
                    key={mapping.app_user_id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{mapping.app_user_email}</span>
                    <span className="font-mono text-xs">{mapping.jira_account_id}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="space-y-2 min-w-[300px]">
              <Label>Sprint</Label>
              <select
                className="h-10 min-w-[300px] rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm"
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                disabled={loadingSprints || sprints.length === 0}
              >
                <option value="">Select sprint</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.isSynced ? 'Synced - ' : 'Not synced - '}
                    {sprint.name} ({sprint.state})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {selectedSprint ? (
                  <>
                    <span
                      className={`rounded-full px-2 py-1 font-medium uppercase ${stateBadgeClass(
                        selectedSprint.state
                      )}`}
                    >
                      {selectedSprint.state}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 font-medium ${
                        selectedSprint.isSynced
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedSprint.isSynced ? 'Synced' : 'Not synced'}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            {isSystemAdmin ? (
              <Button onClick={runSync} disabled={!selectedSprintId || syncing}>
                {syncing ? 'SYNCING...' : 'SYNC'}
              </Button>
            ) : null}
          </div>
          {selectedSprint ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Selected sprint: {selectedSprint.name} (ID {selectedSprint.id})
              </p>
              <p>Last synced: {formatDate(selectedSprint.lastSyncedAt)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">Comparison Workspace</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={runComparison} disabled={comparing}>
                {comparing ? 'Loading...' : 'Refresh comparison'}
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={exportingCsv}>
                {exportingCsv ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2 py-1">
              {selectedComparisonSprintIds.length} sprints selected
            </span>
            <span className="rounded-full bg-muted px-2 py-1">
              {isSystemAdmin
                ? `${selectedComparisonUserIds.length || comparisonUsers.length} users in scope`
                : 'Current user scope'}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Sprints to compare</Label>
              <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-2">
                {sprints.map((sprint) => (
                  <label
                    key={sprint.id}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent/40"
                  >
                    <span className="truncate pr-2">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedComparisonSprintIds.includes(sprint.id)}
                        onChange={() => toggleComparisonSprint(sprint.id)}
                      />
                      {sprint.name}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${stateBadgeClass(sprint.state)}`}>
                      {sprint.state}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {isSystemAdmin ? (
              <div className="space-y-2">
                <Label>Users to compare</Label>
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {comparisonUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center rounded px-2 py-1 text-sm hover:bg-accent/40"
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedComparisonUserIds.includes(user.id)}
                        onChange={() => toggleComparisonUser(user.id)}
                      />
                      <span className="truncate">{user.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg">Sprint comparison (Scope / Completed / Carry-over)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sprintChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sprint" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="scope" fill="#64748b" />
                  <Bar dataKey="completed" fill="#10b981" />
                  <Bar dataKey="carryOver" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg">Completion rate by sprint</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sprintChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sprint" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completionRate" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg">User comparison (tickets and QA transitions)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userAggregateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="userName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tickets" fill="#6366f1" />
                  <Bar dataKey="qaDone" fill="#10b981" />
                  <Bar dataKey="qaRejected" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-display text-lg">Tracked time by user (hours)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userAggregateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="userName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="trackedHours" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg">Sprint Snapshot</h2>
          {!snapshot ? (
            <p className="text-sm text-muted-foreground">
              {loadingAnalytics ? 'Loading...' : 'No snapshot yet for this sprint. Run SYNC first.'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Scope" value={snapshot.scope_total} />
              <MetricCard label="Completed" value={snapshot.completed_total} />
              <MetricCard label="Carry-over" value={snapshot.carry_over_total} />
              <MetricCard
                label="Completion rate"
                value={`${Math.round(Number(snapshot.completion_rate || 0) * 100)}%`}
              />
              <MetricCard label="To Do" value={snapshot.todo_total} />
              <MetricCard label="QA READY" value={snapshot.qa_ready_total} />
              <MetricCard label="QA REJECTED" value={snapshot.qa_rejected_total} />
              <MetricCard label="DONE" value={snapshot.done_total} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg">Per-user metrics</h2>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No user metrics yet. Run SYNC to compute per-user values.
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.map((row) => (
                <div
                  key={row.app_user_id}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border px-3 py-3 text-sm md:grid-cols-5"
                >
                  <div>
                    <p className="font-medium">{row.users?.name || row.jira_display_name || row.users?.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">{row.jira_account_id}</p>
                  </div>
                  <MetricInline label="Tickets" value={row.issue_count} />
                  <MetricInline label="QA READY→DONE" value={row.qa_ready_to_done_count} />
                  <MetricInline
                    label="QA READY→QA REJECTED"
                    value={row.qa_ready_to_rejected_count}
                  />
                  <MetricInline label="Tracked time" value={formatSeconds(row.tracked_time_seconds)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
