import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type RequestRejectedEmailProps = {
  employeeName: string;
  projectName: string;
  leaveType: string;
  dateRange: string;
  reason?: string;
  requestUrl: string;
};

export function RequestRejectedEmail({
  employeeName,
  projectName,
  leaveType,
  dateRange,
  reason,
  requestUrl,
}: RequestRejectedEmailProps) {
  return (
    <EmailLayout
      preview={`Your ${leaveType} request in ${projectName} was not approved`}
      title="Your leave request was not approved"
      intro={`Hi ${employeeName}, your ${leaveType} request in ${projectName} was reviewed and not approved.`}
      ctaLabel="View request"
      ctaUrl={requestUrl}
    >
      {reason ? (
        <EmailCallout tone="danger">
          Reason: {reason}
        </EmailCallout>
      ) : (
        <EmailCallout tone="danger">
          Reach out to your project lead if you need more context.
        </EmailCallout>
      )}
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
