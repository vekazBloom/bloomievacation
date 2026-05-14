import { format } from 'date-fns';

export function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function buildInviteRoleSummary(params: {
  projectRole: string;
  grantSystemAdmin: boolean;
  hasProject: boolean;
}) {
  const chunks: string[] = [];
  if (params.grantSystemAdmin) {
    chunks.push('System administrator');
  }
  if (params.hasProject) {
    chunks.push(`${formatRoleLabel(params.projectRole)} in the team`);
  }
  if (chunks.length === 0) {
    return 'Member';
  }
  return chunks.join(' · ');
}

export function formatLeaveTypeLabel(leaveType: string) {
  switch (leaveType) {
    case 'annual':
      return 'Annual leave';
    case 'sick':
      return 'Sick leave';
    case 'religious':
      return 'Religious holiday';
    default:
      return leaveType;
  }
}

export function formatEmailDate(value: string | Date) {
  return format(new Date(value), 'PPP');
}
