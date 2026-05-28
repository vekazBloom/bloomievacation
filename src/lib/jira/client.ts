type JiraSearchResponse = {
  total: number;
  issues: Array<{
    key: string;
    fields?: {
      timespent?: number | null;
    };
  }>;
};

export type JiraConnectionConfig = {
  siteUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectKey: string;
  boardId: number;
};

export type JiraSprint = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
};

type JiraWorklog = {
  started: string;
  timeSpentSeconds: number;
};

function authHeader(email: string, token: string) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function normalizeSiteUrl(siteUrl: string) {
  let value = siteUrl.trim();
  value = value.replace(/\/+$/, '');

  // Accept accidentally pasted Jira paths and keep only origin.
  try {
    const parsed = new URL(value);
    value = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Keep original if URL parsing fails; caller validation handles invalid values.
  }

  // Common typo: trailing dot in host (e.g. atlassian.net.)
  value = value.replace(/\.$/, '');
  return value;
}

async function jiraFetch<T>(
  config: JiraConnectionConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const site = normalizeSiteUrl(config.siteUrl);
  const response = await fetch(`${site}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: authHeader(config.jiraEmail, config.jiraApiToken),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Jira request failed (${response.status}): ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getBoardSprints(config: JiraConnectionConfig): Promise<JiraSprint[]> {
  const result = await jiraFetch<{ values?: JiraSprint[] }>(
    config,
    `/rest/agile/1.0/board/${config.boardId}/sprint?maxResults=200`
  );
  return result.values || [];
}

export async function getSprint(config: JiraConnectionConfig, sprintId: number): Promise<JiraSprint> {
  return jiraFetch<JiraSprint>(config, `/rest/agile/1.0/sprint/${sprintId}`);
}

export async function searchIssues(
  config: JiraConnectionConfig,
  jql: string,
  fields: string[] = ['key']
): Promise<JiraSearchResponse> {
  const selectedFields = fields.length > 0 ? fields : ['key'];

  // Atlassian removed /rest/api/3/search on some tenants. Prefer the new endpoint.
  try {
    return await jiraFetch<JiraSearchResponse>(config, `/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql,
        fields: selectedFields,
        maxResults: 1000,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('(404)') && !message.includes('(410)')) {
      throw error;
    }

    // Backward compatibility for older Jira tenants that still support /search.
    return jiraFetch<JiraSearchResponse>(config, `/rest/api/3/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql,
        fields: selectedFields,
        maxResults: 1000,
      }),
    });
  }
}

export async function countIssues(config: JiraConnectionConfig, jql: string): Promise<number> {
  const result = await searchIssues(config, jql, ['key']);
  if (typeof result.total === 'number' && Number.isFinite(result.total)) {
    return result.total;
  }
  return Array.isArray(result.issues) ? result.issues.length : 0;
}

export async function sumIssueTimespent(config: JiraConnectionConfig, jql: string): Promise<number> {
  const result = await searchIssues(config, jql, ['timespent']);
  return (result.issues || []).reduce((sum, issue) => {
    return sum + Number(issue.fields?.timespent || 0);
  }, 0);
}

export async function listIssueKeys(config: JiraConnectionConfig, jql: string): Promise<string[]> {
  const result = await searchIssues(config, jql, ['key']);
  const keys = (result.issues || []).map((issue) => issue.key).filter(Boolean);
  return Array.from(new Set(keys));
}

export async function getIssueWorklogs(config: JiraConnectionConfig, issueKey: string): Promise<JiraWorklog[]> {
  let startAt = 0;
  const maxResults = 100;
  const all: JiraWorklog[] = [];

  while (true) {
    const result = await jiraFetch<{
      worklogs?: JiraWorklog[];
      total?: number;
      maxResults?: number;
      startAt?: number;
    }>(
      config,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?startAt=${startAt}&maxResults=${maxResults}`
    );

    const batch = result.worklogs || [];
    all.push(...batch);

    const total = Number(result.total || 0);
    if (!Number.isFinite(total) || all.length >= total || batch.length === 0) {
      break;
    }
    startAt += maxResults;
  }

  return all;
}
