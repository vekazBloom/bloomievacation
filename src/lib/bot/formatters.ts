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

export function formatProfile(profile: {
  name: string;
  email: string;
  phoneNumber: string | null;
  isSystemAdmin: boolean;
}) {
  return (
    `Profil:\n` +
    `Ime: ${profile.name}\n` +
    `Email: ${profile.email}\n` +
    `Telefon: ${profile.phoneNumber ?? '—'}\n` +
    `System admin: ${profile.isSystemAdmin ? 'da' : 'ne'}`
  );
}

export function formatNotifications(result: {
  notifications: Array<{
    title: string;
    message: string | null;
    isUnread: boolean;
    createdAt: string;
  }>;
  unreadCount: number;
}) {
  if (result.notifications.length === 0) {
    return 'Nemate notifikacija.';
  }
  const lines = result.notifications.map((n) => {
    const badge = n.isUnread ? '🔵 ' : '';
    const body = n.message ? `: ${n.message}` : '';
    return `${badge}• ${n.title}${body}`;
  });
  return `Notifikacije (${result.unreadCount} nepročitanih):\n${lines.join('\n')}`;
}

export function formatProjectMembers(members: Array<{ name: string; email: string; role: string }>) {
  if (members.length === 0) return 'Projekat nema članova.';
  const lines = members.map((m) => `• ${m.name} (${m.role}) — ${m.email}`);
  return `Članovi projekta:\n${lines.join('\n')}`;
}

export function formatProjectDetails(project: {
  name: string;
  vacationThresholdPercent: number | null;
  carryOverPolicy: string | null;
}) {
  return (
    `Projekat: ${project.name}\n` +
    `Prag godišnjeg: ${project.vacationThresholdPercent ?? '—'}%\n` +
    `Carry-over politika: ${project.carryOverPolicy ?? '—'}`
  );
}

export function formatHolidays(holidays: Array<{ name: string; date: string }>, label: string) {
  if (holidays.length === 0) return `Nema ${label}.`;
  const lines = holidays.map((h) => `• ${h.name} — ${h.date}`);
  return `${label}:\n${lines.join('\n')}`;
}

export function formatReligiousSelections(year: number, selections: Array<{ name: string; date: string }>) {
  if (selections.length === 0) {
    return `Nemate odabranih vjerskih praznika za ${year}.`;
  }
  const lines = selections.map((s) => `• ${s.name} — ${s.date}`);
  return `Vjerski praznici za ${year}:\n${lines.join('\n')}`;
}

export function formatCarryOverDecisions(
  decisions: Array<{
    projectName: string;
    year: number;
    decision: string;
    remainingDays: number | null;
  }>
) {
  if (decisions.length === 0) return 'Nemate carry-over odluka.';
  const lines = decisions.map(
    (d) => `• ${d.projectName} (${d.year}): ${d.decision}, ${d.remainingDays ?? '—'} dana`
  );
  return `Carry-over odluke:\n${lines.join('\n')}`;
}

export function formatProjectRequests(
  requests: Array<{
    employeeName: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    status: string;
    workingDays: number | null;
  }>
) {
  if (requests.length === 0) return 'Nema zahtjeva u projektu.';
  const lines = requests.map((r) => {
    const typeLabel = TYPE_LABELS[r.type] ?? r.type;
    const statusLabel = STATUS_LABELS[r.status] ?? r.status;
    const range = formatDateRange(r.startDate, r.endDate);
    const days = r.workingDays != null ? `, ${r.workingDays} dana` : '';
    return `• ${r.employeeName} — ${typeLabel} (${range}), ${statusLabel}${days}`;
  });
  return `Zahtjevi projekta:\n${lines.join('\n')}`;
}

export function formatInvitations(
  invitations: Array<{ email: string; role: string; projectName?: string; status?: string }>
) {
  if (invitations.length === 0) return 'Nema pending pozivnica.';
  const lines = invitations.map((inv) => {
    const project = inv.projectName ? `, ${inv.projectName}` : '';
    return `• ${inv.email} (${inv.role})${project}`;
  });
  return `Pozivnice:\n${lines.join('\n')}`;
}

export function formatJiraSprints(sprints: Array<{ id: number; name: string; state: string }>) {
  if (sprints.length === 0) return 'Nema Jira sprintova.';
  const lines = sprints.map((s) => `• ${s.name} (${s.state}) — ID ${s.id}`);
  return `Jira sprintovi:\n${lines.join('\n')}`;
}

export function formatJiraAnalytics(result: {
  snapshot: { sprintName?: string } | null;
  userMetrics: Array<{
    userName: string;
    issuesCompleted: unknown;
    issuesTotal: unknown;
  }>;
}) {
  const sprintName = result.snapshot?.sprintName ?? 'Sprint';
  if (result.userMetrics.length === 0) {
    return `Nema podataka za sprint ${sprintName}.`;
  }
  const lines = result.userMetrics.map(
    (m) => `• ${m.userName}: ${m.issuesCompleted}/${m.issuesTotal} issue-a`
  );
  return `Jira analitika — ${sprintName}:\n${lines.join('\n')}`;
}

export const READ_ONLY_FORMAT_TOOLS = new Set([
  'get_my_profile',
  'list_my_notifications',
  'list_my_projects',
  'get_leave_balance',
  'list_my_requests',
  'list_national_holidays',
  'list_religious_holidays',
  'get_my_religious_selections',
  'get_carry_over_decisions',
  'list_annual_fund_definitions',
  'get_project_details',
  'get_project_members',
  'get_project_overview',
  'list_project_requests',
  'get_team_on_leave',
  'get_team_on_leave_today',
  'get_team_on_leave_this_week',
  'list_pending_team_requests',
  'get_vacation_overlap',
  'list_project_invitations',
  'list_sent_invitations',
  'search_users_for_invite',
  'get_jira_config',
  'list_jira_sprints',
  'get_jira_sprint_analytics',
]);

export function formatToolResult(toolName: string, result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;

  if ('ok' in result && result.ok === false && 'error' in result) {
    return String((result as { error: string }).error);
  }

  switch (toolName) {
    case 'get_my_profile':
      if ('profile' in result) {
        return formatProfile((result as { profile: Parameters<typeof formatProfile>[0] }).profile);
      }
      return null;

    case 'list_my_notifications':
      if ('notifications' in result) {
        return formatNotifications(
          result as {
            notifications: Parameters<typeof formatNotifications>[0]['notifications'];
            unreadCount: number;
          }
        );
      }
      return null;

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
        return formatProjectsList(
          (result as { projects: Array<{ name: string; role: string; projectId: string }> }).projects
        );
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

    case 'list_national_holidays':
      if ('holidays' in result) {
        return formatHolidays(
          (result as { holidays: Array<{ name: string; date: string }> }).holidays,
          'Državni praznici'
        );
      }
      return null;

    case 'list_religious_holidays':
      if ('holidays' in result) {
        return formatHolidays(
          (result as { holidays: Array<{ name: string; date: string }> }).holidays,
          'Vjerski praznici (pool)'
        );
      }
      return null;

    case 'get_my_religious_selections':
      if ('selections' in result && 'year' in result) {
        return formatReligiousSelections(
          (result as { year: number }).year,
          (result as { selections: Array<{ name: string; date: string }> }).selections
        );
      }
      return null;

    case 'get_carry_over_decisions':
      if ('decisions' in result) {
        return formatCarryOverDecisions(
          (result as {
            decisions: Array<{
              projectName: string;
              year: number;
              decision: string;
              remainingDays: number | null;
            }>;
          }).decisions
        );
      }
      return null;

    case 'get_project_details':
      if ('project' in result) {
        return formatProjectDetails(
          (result as { project: Parameters<typeof formatProjectDetails>[0] }).project
        );
      }
      return null;

    case 'get_project_members':
      if ('members' in result) {
        return formatProjectMembers(
          (result as { members: Array<{ name: string; email: string; role: string }> }).members
        );
      }
      return null;

    case 'list_project_requests':
      if ('requests' in result) {
        return formatProjectRequests(
          (result as {
            requests: Array<{
              employeeName: string;
              type: LeaveType;
              startDate: string;
              endDate: string;
              status: string;
              workingDays: number | null;
            }>;
          }).requests
        );
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

    case 'list_project_invitations':
    case 'list_sent_invitations':
      if ('invitations' in result) {
        return formatInvitations(
          (result as {
            invitations: Array<{ email: string; role: string; projectName?: string }>;
          }).invitations
        );
      }
      return null;

    case 'search_users_for_invite':
      if ('users' in result) {
        const users = (result as { users: Array<{ name: string; email: string }> }).users;
        if (users.length === 0) return 'Nema korisnika za taj upit.';
        return `Korisnici:\n${users.map((u) => `• ${u.name} — ${u.email}`).join('\n')}`;
      }
      return null;

    case 'get_jira_config':
      if ('connected' in result) {
        const r = result as { connected: boolean; config?: { siteUrl?: string; projectKey?: string } };
        if (!r.connected) return 'Jira nije povezan.';
        return `Jira: ${r.config?.siteUrl ?? '—'}, projekat ${r.config?.projectKey ?? '—'}`;
      }
      return null;

    case 'list_jira_sprints':
      if ('sprints' in result) {
        return formatJiraSprints(
          (result as { sprints: Array<{ id: number; name: string; state: string }> }).sprints
        );
      }
      return null;

    case 'get_jira_sprint_analytics':
      if ('userMetrics' in result) {
        return formatJiraAnalytics(
          result as {
            snapshot: { sprintName?: string } | null;
            userMetrics: Array<{
              userName: string;
              issuesCompleted: unknown;
              issuesTotal: unknown;
            }>;
          }
        );
      }
      return null;

    default:
      return null;
  }
}
