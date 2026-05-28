'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type AppUser = { id: string; email: string; name: string };
type Mapping = {
  app_user_id: string;
  app_user_email: string;
  jira_account_id: string;
  jira_display_name: string | null;
};

type BoardConfig = { boardId: number; projectKey: string; label?: string };

export function JiraSettingsPanel() {
  const [siteUrl, setSiteUrl] = useState('');
  const [projectKey, setProjectKey] = useState('GO');
  const [boardId, setBoardId] = useState('166');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [defaultBoardId, setDefaultBoardId] = useState('');
  const [boardConfigs, setBoardConfigs] = useState<BoardConfig[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingUserId, setMappingUserId] = useState('');
  const [mappingAccountId, setMappingAccountId] = useState('');
  const [mappingDisplayName, setMappingDisplayName] = useState('');

  async function load() {
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
      setDefaultBoardId(String(configPayload.config.defaultBoardId || configPayload.config.boardId || ''));
      setBoardConfigs(
        (configPayload.config.boardConfigs || []).map((row: any) => ({
          boardId: Number(row.boardId),
          projectKey: String(row.projectKey || ''),
          label: row.label ? String(row.label) : '',
        }))
      );
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
        jiraApiToken: jiraApiToken || undefined,
        defaultBoardId: Number(defaultBoardId || boardId),
        boardConfigs: boardConfigs
          .filter((row) => Number(row.boardId) > 0 && row.projectKey.trim().length > 0)
          .map((row) => ({
            boardId: Number(row.boardId),
            projectKey: row.projectKey.trim().toUpperCase(),
            label: row.label?.trim() || undefined,
          })),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setSavingConfig(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to save Jira settings');
    toast.success('Jira settings saved');
    setJiraApiToken('');
    await load();
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
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg">Jira Connection Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Site URL</Label>
              <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jira email</Label>
              <Input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fallback project key</Label>
              <Input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fallback board ID</Label>
              <Input value={boardId} onChange={(e) => setBoardId(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Jira API token</Label>
              <Input
                type="password"
                value={jiraApiToken}
                onChange={(e) => setJiraApiToken(e.target.value)}
                placeholder="Leave empty to keep existing token"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Boards available on analytics page</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setBoardConfigs((rows) => [...rows, { boardId: 0, projectKey: projectKey || 'GO', label: '' }])
                }
              >
                Add board
              </Button>
            </div>
            <div className="space-y-2">
              {boardConfigs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No boards configured yet.</p>
              ) : (
                boardConfigs.map((row, idx) => (
                  <div key={`${idx}-${row.boardId}`} className="grid gap-2 md:grid-cols-4">
                    <Input
                      placeholder="Board ID"
                      value={String(row.boardId || '')}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        setBoardConfigs((rows) =>
                          rows.map((item, itemIdx) => (itemIdx === idx ? { ...item, boardId: value } : item))
                        );
                      }}
                    />
                    <Input
                      placeholder="Project key"
                      value={row.projectKey}
                      onChange={(e) =>
                        setBoardConfigs((rows) =>
                          rows.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, projectKey: e.target.value } : item
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={row.label || ''}
                      onChange={(e) =>
                        setBoardConfigs((rows) =>
                          rows.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setBoardConfigs((rows) => rows.filter((_, itemIdx) => itemIdx !== idx))}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Label>Default board ID</Label>
              <Input value={defaultBoardId} onChange={(e) => setDefaultBoardId(e.target.value)} />
            </div>
          </div>

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Jira settings'}
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
}
