import { EmailDetails, EmailLayout } from './components/email-layout';

export type ProjectAddedEmailProps = {
  recipientName: string;
  projectName: string;
  addedByName: string;
  projectUrl: string;
};

export function ProjectAddedEmail({
  recipientName,
  projectName,
  addedByName,
  projectUrl,
}: ProjectAddedEmailProps) {
  return (
    <EmailLayout
      preview={`You joined ${projectName} on BloomieVacation`}
      title={`Welcome to ${projectName}`}
      intro={`Hi ${recipientName}, you are now part of ${projectName}. Your leave balances and team calendar are ready.`}
      ctaLabel="Open project"
      ctaUrl={projectUrl}
    >
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Added by', value: addedByName },
        ]}
      />
    </EmailLayout>
  );
}
