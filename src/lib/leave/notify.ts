import {
  sendRequestApprovedEmail,
  sendRequestDatesChangedEmail,
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
        startDate: params.startDate,
        endDate: params.endDate,
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
      employeeEmail: employee.email,
      projectName: params.projectName,
      leaveType: params.leaveType,
      startDate: params.startDate,
      endDate: params.endDate,
      requestId: params.requestId,
      projectSlug,
    });
  } else {
    await sendRequestRejectedEmail({
      to: employee.email,
      employeeName: employee.name,
      projectName: params.projectName,
      leaveType: params.leaveType,
      startDate: params.startDate,
      endDate: params.endDate,
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
    /** Reviewers who already know — typically whoever made the edit, and the employee. */
    excludeUserIds?: string[];
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
  const skip = new Set(params.excludeUserIds ?? []);

  for (const reviewer of reviewers || []) {
    if (skip.has(reviewer.user_id)) continue;
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
        startDate: params.startDate,
        endDate: params.endDate,
        requestId: params.requestId,
        projectSlug,
      });
    }
  }
}

/**
 * A reviewer moved the dates of someone else's request. Unlike notifyRequestEdited — which tells
 * reviewers that an employee changed something — this tells the employee, then keeps the rest of the
 * review team in the loop.
 */
export async function notifyRequestDatesChanged(
  service: ServiceClient,
  params: {
    requestId: string;
    projectId: string;
    projectName: string;
    employeeUserId: string;
    editorUserId: string;
    editorName: string;
    leaveType: LeaveType;
    previousStartDate: string;
    previousEndDate: string;
    startDate: string;
    endDate: string;
    previousWorkingDays: number;
    workingDays: number;
  }
) {
  const { slug: projectSlug } = await getProjectSlugById(service, params.projectId);
  if (!projectSlug) return;

  const { data: employee } = await service
    .from('users')
    .select('name, email')
    .eq('id', params.employeeUserId)
    .maybeSingle();

  const previousRange = formatDateRange(params.previousStartDate, params.previousEndDate);
  const newRange = formatDateRange(params.startDate, params.endDate);

  await createInAppNotification(service, {
    userId: params.employeeUserId,
    type: 'request_edited',
    title: `Your ${params.leaveType} leave was moved to new dates`,
    message: `${previousRange} → ${newRange}`,
    link: projectPath(projectSlug, 'requests'),
  });

  if (employee?.email && (await shouldSendEmail(service, params.employeeUserId))) {
    await sendRequestDatesChangedEmail({
      to: employee.email,
      employeeName: employee.name || 'there',
      editorName: params.editorName,
      projectName: params.projectName,
      leaveType: params.leaveType,
      previousStartDate: params.previousStartDate,
      previousEndDate: params.previousEndDate,
      startDate: params.startDate,
      endDate: params.endDate,
      previousWorkingDays: params.previousWorkingDays,
      workingDays: params.workingDays,
      requestId: params.requestId,
      projectSlug,
    });
  }

  await notifyRequestEdited(service, {
    requestId: params.requestId,
    projectId: params.projectId,
    projectName: params.projectName,
    editorName: params.editorName,
    leaveType: params.leaveType,
    startDate: params.startDate,
    endDate: params.endDate,
    excludeUserIds: [params.editorUserId, params.employeeUserId],
  });
}
