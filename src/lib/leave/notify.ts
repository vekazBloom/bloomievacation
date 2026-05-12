import {
  sendRequestApprovedEmail,
  sendRequestEditedEmail,
  sendRequestRejectedEmail,
  sendRequestSubmittedEmail,
} from '@/lib/email/send';
import { shouldSendEmail } from '@/lib/email/preferences';
import { projectPath } from '@/lib/projects/paths';
import { getProjectSlugById } from '@/lib/projects/resolve';
import { formatDateRange } from '@/lib/utils';
import { createInAppNotification } from '@/lib/notifications/in-app';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveType } from '@/types/database';

type ServiceClient = AppSupabase;

export async function notifyRequestSubmitted(
  service: ServiceClient,
  params: {
    projectId: string;
    requestId: string;
    employeeName: string;
    employeeEmail: string;
    projectName: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
  }
) {
  const { slug: projectSlug } = await getProjectSlugById(service, params.projectId);
  if (!projectSlug) return;

  const { data: reviewers } = await service
    .from('project_members')
    .select('user_id, users(name, email)')
    .eq('project_id', params.projectId)
    .in('role', ['admin', 'lead']);

  const dateRange = formatDateRange(params.startDate, params.endDate);

  for (const reviewer of reviewers || []) {
    const user = reviewer.users as { name?: string; email?: string } | null;
    await createInAppNotification(service, {
      userId: reviewer.user_id,
      type: 'request_submitted',
      title: `New ${params.leaveType} request from ${params.employeeName}`,
      message: dateRange,
      link: projectPath(projectSlug, 'requests'),
    });

    if (user?.email && (await shouldSendEmail(service, reviewer.user_id))) {
      await sendRequestSubmittedEmail({
        to: user.email,
        managerName: user.name || 'Team lead',
        employeeName: params.employeeName,
        projectName: params.projectName,
        leaveType: params.leaveType,
        dateRange,
        requestId: params.requestId,
        projectSlug,
      });
    }
  }
}

export async function notifyRequestDecision(
  service: ServiceClient,
  params: {
    requestId: string;
    projectId: string;
    projectName: string;
    employeeUserId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    status: 'approved' | 'rejected';
    reason?: string;
  }
) {
  const { slug: projectSlug } = await getProjectSlugById(service, params.projectId);
  if (!projectSlug) return;

  const { data: employee } = await service
    .from('users')
    .select('name, email')
    .eq('id', params.employeeUserId)
    .maybeSingle();

  const dateRange = formatDateRange(params.startDate, params.endDate);

  await createInAppNotification(service, {
    userId: params.employeeUserId,
    type: params.status === 'approved' ? 'request_approved' : 'request_rejected',
    title:
      params.status === 'approved'
        ? `Your ${params.leaveType} request was approved`
        : `Your ${params.leaveType} request was not approved`,
    message: dateRange,
    link: projectPath(projectSlug, 'requests'),
  });

  if (!employee?.email || !(await shouldSendEmail(service, params.employeeUserId))) return;

  if (params.status === 'approved') {
    await sendRequestApprovedEmail({
      to: employee.email,
      employeeName: employee.name,
      projectName: params.projectName,
      leaveType: params.leaveType,
      dateRange,
      requestId: params.requestId,
      projectSlug,
    });
  } else {
    await sendRequestRejectedEmail({
      to: employee.email,
      employeeName: employee.name,
      projectName: params.projectName,
      leaveType: params.leaveType,
      dateRange,
      reason: params.reason,
      requestId: params.requestId,
      projectSlug,
    });
  }
}

export async function notifyRequestEdited(
  service: ServiceClient,
  params: {
    requestId: string;
    projectId: string;
    projectName: string;
    editorName: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
  }
) {
  const { slug: projectSlug } = await getProjectSlugById(service, params.projectId);
  if (!projectSlug) return;

  const { data: reviewers } = await service
    .from('project_members')
    .select('user_id, users(name, email)')
    .eq('project_id', params.projectId)
    .in('role', ['admin', 'lead']);

  const dateRange = formatDateRange(params.startDate, params.endDate);

  for (const reviewer of reviewers || []) {
    const user = reviewer.users as { name?: string; email?: string } | null;
    await createInAppNotification(service, {
      userId: reviewer.user_id,
      type: 'request_edited',
      title: `Leave request updated in ${params.projectName}`,
      message: dateRange,
      link: projectPath(projectSlug, 'requests'),
    });

    if (user?.email && (await shouldSendEmail(service, reviewer.user_id))) {
      await sendRequestEditedEmail({
        to: user.email,
        recipientName: user.name || 'Team lead',
        editorName: params.editorName,
        projectName: params.projectName,
        leaveType: params.leaveType,
        dateRange,
        requestId: params.requestId,
        projectSlug,
      });
    }
  }
}
