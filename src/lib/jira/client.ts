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

function authHeader(email: string, token: string) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, '');
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
  const fieldList = fields.join(',');
  return jiraFetch<JiraSearchResponse>(config, `/rest/api/3/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql,
      fields: fieldList ? fields : ['key'],
      maxResults: 1000,
    }),
  });
}

export async function countIssues(config: JiraConnectionConfig, jql: string): Promise<number> {
  const result = await searchIssues(config, jql, ['key']);
  return result.total || 0;
}

export async function sumIssueTimespent(config: JiraConnectionConfig, jql: string): Promise<number> {
  const result = await searchIssues(config, jql, ['timespent']);
  return (result.issues || []).reduce((sum, issue) => {
    return sum + Number(issue.fields?.timespent || 0);
  }, 0);
}
