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
import { Label } from '@/components/ui/label';

type Sprint = {
  id: number;
  name: string;
  state: string;
  isSynced: boolean;
  lastSyncedAt: string | null;
};
type Snapshot = {
  sprint_id?: number;
  sprint_name?: string;
  scope_total: number;
  completed_total: number;
  carry_over_total: number;
  completion_rate: number;
  todo_total: number;
  qa_ready_total: number;
  qa_rejected_total: number;
  done_total: number;
};
type MetricRow = {
  app_user_id: string;
  jira_account_id: string;
  jira_display_name: string | null;
  issue_count: number;
  qa_ready_to_done_count: number;
  qa_ready_to_rejected_count: number;
  qa_ready_done_only_count?: number;
  qa_ready_both_transitions_count?: number;
  tracked_time_seconds: number;
  users?: { name?: string | null; email?: string | null };
};
type AppUser = { id: string; email: string; name: string };
type BoardOption = { boardId: number; projectKey: string; label?: string };
type CompareUserRow = {
  sprintId: number;
  appUserId: string;
  userName: string;
  issueCount: number;
  qaReadyToDoneCount: number;
  qaReadyToRejectedCount: number;
  trackedTimeSeconds: number;
};

function formatSeconds(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
}
function formatDate(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [boardOptions, setBoardOptions] = useState<BoardOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [selectedComparisonSprintIds, setSelectedComparisonSprintIds] = useState<number[]>([]);
  const [selectedComparisonUserIds, setSelectedComparisonUserIds] = useState<string[]>([]);
  const [compareSprintsSnapshots, setCompareSprintsSnapshots] = useState<Snapshot[]>([]);
  const [compareUsersRows, setCompareUsersRows] = useState<CompareUserRow[]>([]);
  const [comparing, setComparing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const selectedSprint = useMemo(() => sprints.find((s) => s.id === selectedSprintId) || null, [sprints, selectedSprintId]);

  async function loadBoardContext() {
    if (!isSystemAdmin) {
      await loadSprints(null);
      return;
    }
    const [configRes, usersRes] = await Promise.all([fetch('/api/jira/config'), fetch('/api/jira/users')]);
    const [configPayload, usersPayload] = await Promise.all([configRes.json().catch(() => ({})), usersRes.json().catch(() => ({}))]);
    if (usersRes.ok) setUsers(usersPayload.users || []);
    if (configRes.ok && configPayload.config) {
      const options: BoardOption[] = (configPayload.config.boardConfigs || [])
        .map((row: any) => ({ boardId: Number(row.boardId), projectKey: String(row.projectKey || ''), label: row.label ? String(row.label) : '' }))
        .filter((row: BoardOption) => Number.isInteger(row.boardId) && row.boardId > 0);
      setBoardOptions(options);
      const defaultBoard = Number(configPayload.config.defaultBoardId || configPayload.config.boardId || 0) || null;
      setSelectedBoardId(defaultBoard);
      await loadSprints(defaultBoard);
      return;
    }
    await loadSprints(null);
  }

  async function loadSprints(boardId: number | null) {
    setLoadingSprints(true);
    const response = await fetch(boardId ? `/api/jira/sprints?boardId=${boardId}` : '/api/jira/sprints');
    const payload = await response.json().catch(() => ({}));
    setLoadingSprints(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to load sprints');
    setSprints(payload.sprints || []);
    if (payload.sprints?.length) {
      setSelectedSprintId((current) => current || payload.sprints[0].id);
      setSelectedComparisonSprintIds((current) => (current.length > 0 ? current : payload.sprints.slice(0, 2).map((s: Sprint) => s.id)));
    }
  }

  async function loadAnalytics(sprintId: number, boardId: number | null) {
    setLoadingAnalytics(true);
    const response = await fetch(`/api/jira/analytics?sprintId=${sprintId}${boardId ? `&boardId=${boardId}` : ''}`);
    const payload = await response.json().catch(() => ({}));
    setLoadingAnalytics(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to load analytics');
    setSnapshot(payload.snapshot || null);
    setMetrics(payload.userMetrics || []);
  }

  async function runSync() {
    if (!selectedSprintId) return;
    setSyncing(true);
    const response = await fetch('/api/jira/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId: selectedSprintId, boardId: selectedBoardId || undefined }),
    });
    const payload = await response.json().catch(() => ({}));
    setSyncing(false);
    if (!response.ok) return toast.error(payload.error || 'Sync failed');
    toast.success('Sprint synced successfully');
    await loadAnalytics(selectedSprintId, selectedBoardId);
    await loadSprints(selectedBoardId);
  }

  async function runComparison() {
    if (selectedComparisonSprintIds.length === 0) return toast.error('Select at least one sprint');
    setComparing(true);
    const sprintIdsParam = selectedComparisonSprintIds.join(',');
    const userIdsParam = selectedComparisonUserIds.join(',');
    const boardParam = selectedBoardId ? `&boardId=${selectedBoardId}` : '';
    const [sprintRes, userRes] = await Promise.all([
      fetch(`/api/jira/analytics/compare-sprints?sprintIds=${encodeURIComponent(sprintIdsParam)}${boardParam}`),
      fetch(`/api/jira/analytics/compare-users?sprintIds=${encodeURIComponent(sprintIdsParam)}${userIdsParam ? `&userIds=${encodeURIComponent(userIdsParam)}` : ''}${boardParam}`),
    ]);
    const [sprintPayload, userPayload] = await Promise.all([sprintRes.json().catch(() => ({})), userRes.json().catch(() => ({}))]);
    setComparing(false);
    if (!sprintRes.ok) return toast.error(sprintPayload.error || 'Failed to compare sprints');
    if (!userRes.ok) return toast.error(userPayload.error || 'Failed to compare users');
    setCompareSprintsSnapshots(sprintPayload.snapshots || []);
    setCompareUsersRows(userPayload.rows || []);
  }

  async function exportCsv() {
    if (selectedComparisonSprintIds.length === 0) return toast.error('Select at least one sprint for export');
    setExportingCsv(true);
    const sprintIdsParam = selectedComparisonSprintIds.join(',');
    const userIdsParam = selectedComparisonUserIds.join(',');
    const boardParam = selectedBoardId ? `&boardId=${selectedBoardId}` : '';
    const response = await fetch(`/api/jira/analytics/export?sprintIds=${encodeURIComponent(sprintIdsParam)}${userIdsParam ? `&userIds=${encodeURIComponent(userIdsParam)}` : ''}${boardParam}`);
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

  useEffect(() => {
    void loadBoardContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSprintId) void loadAnalytics(selectedSprintId, selectedBoardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSprintId, selectedBoardId]);

  const sprintChartData = useMemo(
    () => (compareSprintsSnapshots || []).map((row) => ({
      sprint: row.sprint_name || `#${row.sprint_id}`,
      scope: Number(row.scope_total || 0),
      completed: Number(row.completed_total || 0),
      carryOver: Number(row.carry_over_total || 0),
      completionRate: Math.round(Number(row.completion_rate || 0) * 100),
    })),
    [compareSprintsSnapshots]
  );

  const userAggregateData = useMemo(() => {
    const map = new Map<string, { userName: string; tickets: number; qaDone: number; qaRejected: number; trackedHours: number }>();
    for (const row of compareUsersRows) {
      const current = map.get(row.appUserId) || { userName: row.userName, tickets: 0, qaDone: 0, qaRejected: 0, trackedHours: 0 };
      current.tickets += Number(row.issueCount || 0);
      current.qaDone += Number(row.qaReadyToDoneCount || 0);
      current.qaRejected += Number(row.qaReadyToRejectedCount || 0);
      current.trackedHours += Number(row.trackedTimeSeconds || 0) / 3600;
      map.set(row.appUserId, current);
    }
    return Array.from(map.values()).map((row) => ({ ...row, trackedHours: Number(row.trackedHours.toFixed(2)) }));
  }, [compareUsersRows]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start gap-3">
            {isSystemAdmin && boardOptions.length > 0 ? (
              <div className="space-y-2 min-w-[280px]">
                <Label>Board</Label>
                <select
                  className="h-10 min-w-[280px] rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm"
                  value={selectedBoardId ?? ''}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    const next = Number.isInteger(value) && value > 0 ? value : null;
                    setSelectedBoardId(next);
                    setSelectedSprintId(null);
                    void loadSprints(next);
                  }}
                >
                  {boardOptions.map((board) => (
                    <option key={board.boardId} value={board.boardId}>
                      {board.label || `Board ${board.boardId}`} ({board.projectKey})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

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
              {selectedSprint ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Last synced: {formatDate(selectedSprint.lastSyncedAt)}</p>
                  <span className={`rounded px-2 py-1 ${stateBadgeClass(selectedSprint.state)}`}>{selectedSprint.state}</span>
                </div>
              ) : null}
            </div>
            {isSystemAdmin ? (
              <Button onClick={runSync} disabled={!selectedSprintId || syncing}>
                {syncing ? 'SYNCING...' : 'SYNC'}
              </Button>
            ) : null}
          </div>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Sprints to compare</Label>
              <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-2">
                {sprints.map((sprint) => (
                  <label key={sprint.id} className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent/40">
                    <span className="truncate pr-2">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedComparisonSprintIds.includes(sprint.id)}
                        onChange={() =>
                          setSelectedComparisonSprintIds((current) =>
                            current.includes(sprint.id) ? current.filter((id) => id !== sprint.id) : current.length >= 8 ? current : [...current, sprint.id]
                          )
                        }
                      />
                      {sprint.name}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${stateBadgeClass(sprint.state)}`}>{sprint.state}</span>
                  </label>
                ))}
              </div>
            </div>

            {isSystemAdmin ? (
              <div className="space-y-2">
                <Label>Users to compare</Label>
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex cursor-pointer items-center rounded px-2 py-1 text-sm hover:bg-accent/40">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedComparisonUserIds.includes(user.id)}
                        onChange={() =>
                          setSelectedComparisonUserIds((current) =>
                            current.includes(user.id) ? current.filter((id) => id !== user.id) : current.length >= 20 ? current : [...current, user.id]
                          )
                        }
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
              <MetricCard label="Completion rate" value={`${Math.round(Number(snapshot.completion_rate || 0) * 100)}%`} />
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
            <p className="text-sm text-muted-foreground">No user metrics yet. Run SYNC to compute per-user values.</p>
          ) : (
            <div className="space-y-2">
              {metrics.map((row) => (
                <div key={row.app_user_id} className="grid grid-cols-1 gap-2 rounded-md border border-border px-3 py-3 text-sm md:grid-cols-7">
                  <div>
                    <p className="font-medium">{row.users?.name || row.jira_display_name || row.users?.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">{row.jira_account_id}</p>
                  </div>
                  <MetricInline label="Tickets" value={row.issue_count} />
                  <MetricInline label="QA READY→DONE" value={row.qa_ready_to_done_count} />
                  <MetricInline label="QA READY→QA REJECTED" value={row.qa_ready_to_rejected_count} />
                  <MetricInline
                    label="Only DONE (never rejected)"
                    value={row.qa_ready_done_only_count ?? 0}
                  />
                  <MetricInline
                    label="Had both transitions"
                    value={row.qa_ready_both_transitions_count ?? 0}
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
