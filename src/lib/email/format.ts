import { format } from 'date-fns';

export function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
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
