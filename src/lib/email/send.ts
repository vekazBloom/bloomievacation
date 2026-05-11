import { CarryOverWarningEmail } from '../../../emails/carry-over-warning';
import { InviteReceivedEmail } from '../../../emails/invite-received';
import { ProjectAddedEmail } from '../../../emails/project-added';
import { ReligiousHolidayLoggedEmail } from '../../../emails/religious-holiday-logged';
import { RequestApprovedEmail } from '../../../emails/request-approved';
import { RequestEditedEmail } from '../../../emails/request-edited';
import { RequestRejectedEmail } from '../../../emails/request-rejected';
import { RequestSubmittedEmail } from '../../../emails/request-submitted';
import type { NotificationType } from '@/types/database';
import { absoluteAppUrl } from './app-url';
import { formatEmailDate, formatLeaveTypeLabel, formatRoleLabel } from './format';
import { sendEmail } from './resend';

export async function sendInviteReceivedEmail(params: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  token: string;
  expiresAt: string;
}) {
  const inviteUrl = absoluteAppUrl(`/invite?token=${params.token}`);
  return sendEmail({
    to: params.to,
    subject: `You're invited to ${params.projectName}`,
    react: InviteReceivedEmail({
      inviteeEmail: params.to,
      inviterName: params.inviterName,
      projectName: params.projectName,
      role: formatRoleLabel(params.role),
      inviteUrl,
      expiresAt: formatEmailDate(params.expiresAt),
    }),
  });
}

export async function sendProjectAddedEmail(params: {
  to: string;
  recipientName: string;
  projectName: string;
  addedByName: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Welcome to ${params.projectName}`,
    react: ProjectAddedEmail({
      recipientName: params.recipientName,
      projectName: params.projectName,
      addedByName: params.addedByName,
      projectUrl: absoluteAppUrl(`/projects/${params.projectId}`),
    }),
  });
}

export async function sendRequestSubmittedEmail(params: {
  to: string;
  managerName: string;
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  requestId: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `New leave request from ${params.employeeName}`,
    react: RequestSubmittedEmail({
      managerName: params.managerName,
      employeeName: params.employeeName,
      projectName: params.projectName,
      leaveType: formatLeaveTypeLabel(params.leaveType),
      dateRange: params.dateRange,
      requestUrl: absoluteAppUrl(`/projects/${params.projectId}/requests/${params.requestId}`),
    }),
  });
}

export async function sendRequestApprovedEmail(params: {
  to: string;
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  requestId: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Your leave request in ${params.projectName} was approved`,
    react: RequestApprovedEmail({
      employeeName: params.employeeName,
      projectName: params.projectName,
      leaveType: formatLeaveTypeLabel(params.leaveType),
      dateRange: params.dateRange,
      requestUrl: absoluteAppUrl(`/projects/${params.projectId}/requests/${params.requestId}`),
    }),
  });
}

export async function sendRequestRejectedEmail(params: {
  to: string;
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  reason?: string;
  requestId: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Your leave request in ${params.projectName} was not approved`,
    react: RequestRejectedEmail({
      employeeName: params.employeeName,
      projectName: params.projectName,
      leaveType: formatLeaveTypeLabel(params.leaveType),
      dateRange: params.dateRange,
      reason: params.reason,
      requestUrl: absoluteAppUrl(`/projects/${params.projectId}/requests/${params.requestId}`),
    }),
  });
}

export async function sendRequestEditedEmail(params: {
  to: string;
  recipientName: string;
  editorName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  requestId: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Leave request updated in ${params.projectName}`,
    react: RequestEditedEmail({
      recipientName: params.recipientName,
      editorName: params.editorName,
      projectName: params.projectName,
      leaveType: formatLeaveTypeLabel(params.leaveType),
      dateRange: params.dateRange,
      requestUrl: absoluteAppUrl(`/projects/${params.projectId}/requests/${params.requestId}`),
    }),
  });
}

export async function sendReligiousHolidayLoggedEmail(params: {
  to: string;
  managerName: string;
  employeeName: string;
  projectName: string;
  holidayName: string;
  holidayDate: string;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `${params.employeeName} logged ${params.holidayName}`,
    react: ReligiousHolidayLoggedEmail({
      managerName: params.managerName,
      employeeName: params.employeeName,
      projectName: params.projectName,
      holidayName: params.holidayName,
      holidayDate: formatEmailDate(params.holidayDate),
      calendarUrl: absoluteAppUrl(`/projects/${params.projectId}/calendar`),
    }),
  });
}

export async function sendCarryOverWarningEmail(params: {
  to: string;
  employeeName: string;
  projectName: string;
  daysRemaining: number;
  year: number;
  projectId: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Carry-over decision needed for ${params.projectName}`,
    react: CarryOverWarningEmail({
      employeeName: params.employeeName,
      projectName: params.projectName,
      daysRemaining: params.daysRemaining,
      year: params.year,
      decisionUrl: absoluteAppUrl(`/projects/${params.projectId}/carry-over`),
    }),
  });
}

export async function sendNotificationEmail(
  type: NotificationType,
  params: Record<string, string | number | undefined>
) {
  switch (type) {
    case 'invite_received':
      return sendInviteReceivedEmail({
        to: String(params.to),
        inviterName: String(params.inviterName),
        projectName: String(params.projectName),
        role: String(params.role),
        token: String(params.token),
        expiresAt: String(params.expiresAt),
      });
    case 'project_added':
      return sendProjectAddedEmail({
        to: String(params.to),
        recipientName: String(params.recipientName),
        projectName: String(params.projectName),
        addedByName: String(params.addedByName),
        projectId: String(params.projectId),
      });
    case 'request_submitted':
      return sendRequestSubmittedEmail({
        to: String(params.to),
        managerName: String(params.managerName),
        employeeName: String(params.employeeName),
        projectName: String(params.projectName),
        leaveType: String(params.leaveType),
        dateRange: String(params.dateRange),
        requestId: String(params.requestId),
        projectId: String(params.projectId),
      });
    case 'request_approved':
      return sendRequestApprovedEmail({
        to: String(params.to),
        employeeName: String(params.employeeName),
        projectName: String(params.projectName),
        leaveType: String(params.leaveType),
        dateRange: String(params.dateRange),
        requestId: String(params.requestId),
        projectId: String(params.projectId),
      });
    case 'request_rejected':
      return sendRequestRejectedEmail({
        to: String(params.to),
        employeeName: String(params.employeeName),
        projectName: String(params.projectName),
        leaveType: String(params.leaveType),
        dateRange: String(params.dateRange),
        reason: params.reason ? String(params.reason) : undefined,
        requestId: String(params.requestId),
        projectId: String(params.projectId),
      });
    case 'request_edited':
      return sendRequestEditedEmail({
        to: String(params.to),
        recipientName: String(params.recipientName),
        editorName: String(params.editorName),
        projectName: String(params.projectName),
        leaveType: String(params.leaveType),
        dateRange: String(params.dateRange),
        requestId: String(params.requestId),
        projectId: String(params.projectId),
      });
    case 'religious_holiday_logged':
      return sendReligiousHolidayLoggedEmail({
        to: String(params.to),
        managerName: String(params.managerName),
        employeeName: String(params.employeeName),
        projectName: String(params.projectName),
        holidayName: String(params.holidayName),
        holidayDate: String(params.holidayDate),
        projectId: String(params.projectId),
      });
    case 'carry_over_warning':
      return sendCarryOverWarningEmail({
        to: String(params.to),
        employeeName: String(params.employeeName),
        projectName: String(params.projectName),
        daysRemaining: Number(params.daysRemaining),
        year: Number(params.year),
        projectId: String(params.projectId),
      });
    default:
      return { success: false, error: new Error(`Unsupported notification type: ${type}`) };
  }
}
