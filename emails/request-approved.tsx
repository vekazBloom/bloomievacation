import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type RequestApprovedEmailProps = {
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  requestUrl: string;
};

export function RequestApprovedEmail({
  employeeName,
  projectName,
  leaveType,
  dateRange,
  requestUrl,
}: RequestApprovedEmailProps) {
  return (
    <EmailLayout
      preview={`Your ${leaveType} request in ${projectName} was approved`}
      title="Your leave request was approved"
      intro={`Hi ${employeeName}, your ${leaveType} request in ${projectName} has been approved.`}
      ctaLabel="View request"
      ctaUrl={requestUrl}
    >
      <EmailCallout tone="success">Your time off is confirmed and visible on the team calendar.</EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Leave type', value: leaveType },
          { label: 'Dates', value: dateRange },
        ]}
      />
    </EmailLayout>
  );
}
