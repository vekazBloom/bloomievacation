import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type RequestSubmittedEmailProps = {
  managerName: string;
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  requestUrl: string;
};

export function RequestSubmittedEmail({
  managerName,
  employeeName,
  projectName,
  leaveType,
  dateRange,
  requestUrl,
}: RequestSubmittedEmailProps) {
  return (
    <EmailLayout
      preview={`${employeeName} submitted a ${leaveType} request in ${projectName}`}
      title="New leave request to review"
      intro={`Hi ${managerName}, ${employeeName} submitted a new ${leaveType} request in ${projectName}.`}
      ctaLabel="Review request"
      ctaUrl={requestUrl}
    >
      <EmailCallout tone="warning">
        This request is waiting for approval. Review it before the team calendar changes.
      </EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Employee', value: employeeName },
          { label: 'Project', value: projectName },
          { label: 'Leave type', value: leaveType },
          { label: 'Dates', value: dateRange },
        ]}
      />
    </EmailLayout>
  );
}
