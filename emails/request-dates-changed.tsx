import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type RequestDatesChangedEmailProps = {
  employeeName: string;
  editorName: string;
  projectName: string;
  leaveType: string;
  previousStartDate: string;
  previousEndDate: string;
  startDate: string;
  endDate: string;
  previousWorkingDays: number;
  workingDays: number;
  requestUrl: string;
};

function dayLabel(days: number) {
  return `${days} working day${days === 1 ? '' : 's'}`;
}

export function RequestDatesChangedEmail({
  employeeName,
  editorName,
  projectName,
  leaveType,
  previousStartDate,
  previousEndDate,
  startDate,
  endDate,
  previousWorkingDays,
  workingDays,
  requestUrl,
}: RequestDatesChangedEmailProps) {
  const delta = Math.round((workingDays - previousWorkingDays) * 10) / 10;
  const returned = delta < 0;
  const balanceLine = returned
    ? `${dayLabel(Math.abs(delta))} have been returned to your leave balance.`
    : delta > 0
      ? `${dayLabel(delta)} have been taken from your leave balance.`
      : 'Your leave balance is unchanged.';

  return (
    <EmailLayout
      preview={`${editorName} changed the dates of your ${leaveType} leave in ${projectName}`}
      title="Your approved leave dates were changed"
      intro={`Hi ${employeeName}, ${editorName} changed the dates of your approved ${leaveType} leave in ${projectName}. It is still approved.`}
      ctaLabel="View request"
      ctaUrl={requestUrl}
      footerNote="If these dates are not what you agreed, reply to your team lead so they can correct them."
    >
      <EmailCallout tone={returned ? 'success' : delta > 0 ? 'warning' : 'neutral'}>
        {balanceLine}
      </EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Leave type', value: leaveType },
          { label: 'Previous dates', value: `${previousStartDate} – ${previousEndDate}` },
          { label: 'New dates', value: `${startDate} – ${endDate}` },
          {
            label: 'Working days',
            value: `${dayLabel(previousWorkingDays)} → ${dayLabel(workingDays)}`,
          },
          { label: 'Changed by', value: editorName },
        ]}
      />
    </EmailLayout>
  );
}
