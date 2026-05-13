import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type RequestEditedEmailProps = {
  recipientName: string;
  editorName: string;
  projectName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestUrl: string;
};

export function RequestEditedEmail({
  recipientName,
  editorName,
  projectName,
  leaveType,
  startDate,
  endDate,
  requestUrl,
}: RequestEditedEmailProps) {
  return (
    <EmailLayout
      preview={`${editorName} updated a ${leaveType} request in ${projectName}`}
      title="A leave request was updated"
      intro={`Hi ${recipientName}, ${editorName} updated a ${leaveType} request in ${projectName}.`}
      ctaLabel="View updated request"
      ctaUrl={requestUrl}
    >
      <EmailCallout>Review the latest dates and status before planning around this request.</EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Leave type', value: leaveType },
          { label: 'From', value: startDate },
          { label: 'To', value: endDate },
          { label: 'Updated by', value: editorName },
        ]}
      />
    </EmailLayout>
  );
}
