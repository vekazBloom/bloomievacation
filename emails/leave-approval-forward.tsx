import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type LeaveApprovalForwardEmailProps = {
  approverName: string;
  employeeName: string;
  projectNames: string;
  leaveTypeLabel: string;
  workingDays: number;
  dateRange: string;
  remainingSummary: string;
};

export function LeaveApprovalForwardEmail({
  approverName,
  employeeName,
  projectNames,
  leaveTypeLabel,
  workingDays,
  dateRange,
  remainingSummary,
}: LeaveApprovalForwardEmailProps) {
  return (
    <EmailLayout
      preview={`${employeeName} — ${leaveTypeLabel} approved (${workingDays} day${workingDays === 1 ? '' : 's'})`}
      title="Leave approved (copy)"
      intro={`${approverName} approved a ${leaveTypeLabel} request for ${employeeName}.`}
    >
      <EmailCallout tone="success">This is an automatic copy for your records.</EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Employee', value: employeeName },
          { label: 'Project(s)', value: projectNames },
          { label: 'Leave type', value: leaveTypeLabel },
          { label: 'Working days requested', value: String(workingDays) },
          { label: 'Dates', value: dateRange },
          { label: 'Approved by', value: approverName },
          { label: 'Balance after approval (global)', value: remainingSummary },
        ]}
      />
    </EmailLayout>
  );
}
