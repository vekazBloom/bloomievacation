'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Sprint = {
  id: number;
  name: string;
  state: string;
};

type Snapshot = {
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

function formatSeconds(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return `${hours}h ${mins}m`;
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
    if (!selectedSprintId && payload.sprints?.length) {
      setSelectedSprintId(payload.sprints[0].id);
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

  useEffect(() => {
    void loadSprints();
    void loadConfigAndMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSprintId) void loadAnalytics(selectedSprintId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSprintId]);

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
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Sprint</Label>
              <select
                className="h-10 min-w-[260px] rounded-md border border-input bg-card px-3 text-sm"
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                disabled={loadingSprints || sprints.length === 0}
              >
                <option value="">Select sprint</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({sprint.state})
                  </option>
                ))}
              </select>
            </div>
            {isSystemAdmin ? (
              <Button onClick={runSync} disabled={!selectedSprintId || syncing}>
                {syncing ? 'SYNCING...' : 'SYNC'}
              </Button>
            ) : null}
          </div>
          {selectedSprint ? (
            <p className="text-sm text-muted-foreground">
              Selected sprint: {selectedSprint.name} (ID {selectedSprint.id})
            </p>
          ) : null}
        </CardContent>
      </Card>

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
