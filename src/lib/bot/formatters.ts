import type { LeaveBalanceSummary } from '@/lib/read/leave-balance';
import type { MyLeaveRequestRow, PendingReviewRow } from '@/lib/read/leave-requests';
import type { TeamLeaveRow } from '@/lib/read/team-leave';
import { formatDateRange } from '@/lib/utils';
import type { LeaveType } from '@/types/database';

const TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Godišnji',
  sick: 'Bolovanje',
  religious: 'Vjerski',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'odobreno',
  pending: 'na čekanju',
  rejected: 'odbijeno',
  cancelled: 'otkazano',
};

export function formatTeamLeave(entries: TeamLeaveRow[], periodLabel?: string) {
  if (entries.length === 0) {
    return periodLabel
      ? `Nema zabilježenog odsustva za period: ${periodLabel}.`
      : 'Nema zabilježenog odsustva za traženi period.';
  }

  const lines = entries.map((entry) => {
    const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;
    const statusLabel = STATUS_LABELS[entry.status] ?? entry.status;
    const range = formatDateRange(entry.startDate, entry.endDate);
    return `• ${entry.name} — ${typeLabel} (${range}), ${statusLabel}`;
  });

  const header = periodLabel ? `Odsustva za ${periodLabel}:\n` : 'Odsustva u traženom periodu:\n';
  return header + lines.join('\n');
}

export function formatLeaveBalance(balance: LeaveBalanceSummary) {
  return (
    `Stanje odsustva:\n` +
    `Godišnji: ${balance.annualRemaining} preostalo od ${balance.annualTotal} (iskorišteno ${balance.annualUsed})\n` +
    `Bolovanje: ${balance.sickRemaining} preostalo od ${balance.sickTotal} (iskorišteno ${balance.sickUsed})\n` +
    `Vjerski: ${balance.religiousRemaining} preostalo od ${balance.religiousTotal} (iskorišteno ${balance.religiousUsed})`
  );
}

export function formatMyLeaveRequests(requests: MyLeaveRequestRow[]) {
  if (requests.length === 0) {
    return 'Nemate nedavnih zahtjeva za odsustvo.';
  }

  const lines = requests.map((request) => {
    const typeLabel = TYPE_LABELS[request.type] ?? request.type;
    const statusLabel = STATUS_LABELS[request.status] ?? request.status;
    const range = formatDateRange(request.startDate, request.endDate);
    const days = request.workingDays != null ? `, ${request.workingDays} radnih dana` : '';
    return `• ${typeLabel} (${range}) — ${statusLabel}, ${request.projectName}${days}`;
  });

  return `Vaši zahtjevi:\n${lines.join('\n')}`;
}

export function formatPendingReviews(requests: PendingReviewRow[]) {
  if (requests.length === 0) {
    return 'Nema zahtjeva koji čekaju vaše odobrenje.';
  }

  const lines = requests.map((request) => {
    const typeLabel = TYPE_LABELS[request.type] ?? request.type;
    const range = formatDateRange(request.startDate, request.endDate);
    const days = request.workingDays != null ? `, ${request.workingDays} radnih dana` : '';
    return `• ${request.employeeName} — ${typeLabel} (${range}), ${request.projectName}${days}`;
  });

  return `Zahtjevi na čekanju:\n${lines.join('\n')}`;
}

export function formatVacationOverlap(result: {
  overlapPercent: number;
  overlappingMembers: number;
  totalMembers: number;
  thresholdPercent: number;
  exceedsThreshold: boolean;
}) {
  const thresholdNote = result.exceedsThreshold
    ? ` (prekoračen prag od ${result.thresholdPercent}%)`
    : '';
  return (
    `Preklapanje godišnjeg: ${result.overlapPercent}% tima ` +
    `(${result.overlappingMembers} od ${result.totalMembers} članova)${thresholdNote}.`
  );
}

export function formatProjectsList(
  projects: Array<{ name: string; role: string; projectId: string }>
) {
  if (projects.length === 0) {
    return 'Niste član nijednog aktivnog projekta.';
  }
  const lines = projects.map((p) => `• ${p.name} (${p.role})`);
  return `Vaši projekti:\n${lines.join('\n')}`;
}

export const READ_ONLY_FORMAT_TOOLS = new Set([
  'get_team_on_leave',
  'get_team_on_leave_today',
  'get_team_on_leave_this_week',
  'get_leave_balance',
  'list_my_requests',
  'list_pending_team_requests',
  'get_vacation_overlap',
  'list_my_projects',
]);

export function formatToolResult(toolName: string, result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;

  if ('ok' in result && result.ok === false && 'error' in result) {
    return String((result as { error: string }).error);
  }

  switch (toolName) {
    case 'list_my_projects':
      if (Array.isArray(result)) {
        return formatProjectsList(
          result.map((p) => ({
            name: (p as { name: string }).name,
            role: (p as { role: string }).role,
            projectId: (p as { projectId: string }).projectId,
          }))
        );
      }
      if ('projects' in result && Array.isArray((result as { projects: unknown[] }).projects)) {
        return formatProjectsList((result as { projects: Array<{ name: string; role: string; projectId: string }> }).projects);
      }
      return null;

    case 'get_leave_balance':
      if ('balance' in result) {
        return formatLeaveBalance((result as { balance: LeaveBalanceSummary }).balance);
      }
      if ('annualRemaining' in result) {
        return formatLeaveBalance(result as LeaveBalanceSummary);
      }
      if ('message' in result) {
        return String((result as { message: string }).message);
      }
      return null;

    case 'list_my_requests':
      if (Array.isArray(result)) {
        return formatMyLeaveRequests(result as MyLeaveRequestRow[]);
      }
      if ('requests' in result) {
        return formatMyLeaveRequests((result as { requests: MyLeaveRequestRow[] }).requests);
      }
      return null;

    case 'get_team_on_leave':
    case 'get_team_on_leave_today':
    case 'get_team_on_leave_this_week':
      if ('entries' in result) {
        const entries = (result as { entries: TeamLeaveRow[] }).entries;
        return formatTeamLeave(entries);
      }
      return null;

    case 'list_pending_team_requests':
      if ('requests' in result) {
        return formatPendingReviews((result as { requests: PendingReviewRow[] }).requests);
      }
      return null;

    case 'get_vacation_overlap':
      if ('overlapPercent' in result) {
        return formatVacationOverlap(
          result as {
            overlapPercent: number;
            overlappingMembers: number;
            totalMembers: number;
            thresholdPercent: number;
            exceedsThreshold: boolean;
          }
        );
      }
      return null;

    default:
      return null;
  }
}
