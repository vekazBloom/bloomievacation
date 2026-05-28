import { NextRequest, NextResponse } from 'next/server';
import { getAuthedProfile, getUserComparisonData } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

function parseNumberList(raw: string | null) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

function parseStringList(raw: string | null) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sprintIds = parseNumberList(request.nextUrl.searchParams.get('sprintIds'));
  const requestedUserIds = parseStringList(request.nextUrl.searchParams.get('userIds'));

  if (sprintIds.length < 1) {
    return NextResponse.json({ error: 'At least one sprint is required' }, { status: 400 });
  }
  if (sprintIds.length > 8) {
    return NextResponse.json({ error: 'Maximum 8 sprints can be exported at once' }, { status: 400 });
  }
  if (requestedUserIds.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 users can be exported at once' }, { status: 400 });
  }

  const { rows } = await getUserComparisonData({
    sprintIds,
    requestedUserIds,
    profile: { id: auth.user.id, is_system_admin: auth.profile.is_system_admin },
  });

  const headers = [
    'sprint_id',
    'sprint_name',
    'sprint_state',
    'snapshot_at',
    'app_user_id',
    'user_name',
    'user_email',
    'jira_account_id',
    'issue_count',
    'qa_ready_to_done_count',
    'qa_ready_to_rejected_count',
    'tracked_time_seconds',
    'tracked_time_hours',
    'scope_total',
    'completed_total',
    'carry_over_total',
    'completion_rate',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.sprintId,
        row.sprintName,
        row.sprintState,
        row.snapshotAt,
        row.appUserId,
        row.userName,
        row.userEmail,
        row.jiraAccountId,
        row.issueCount,
        row.qaReadyToDoneCount,
        row.qaReadyToRejectedCount,
        row.trackedTimeSeconds,
        (Number(row.trackedTimeSeconds || 0) / 3600).toFixed(2),
        row.scopeTotal,
        row.completedTotal,
        row.carryOverTotal,
        row.completionRate,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="jira-analytics-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
