import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type CarryOverWarningEmailProps = {
  employeeName: string;
  projectName: string;
  daysRemaining: number;
  year: number;
  decisionUrl: string;
};

export function CarryOverWarningEmail({
  employeeName,
  projectName,
  daysRemaining,
  year,
  decisionUrl,
}: CarryOverWarningEmailProps) {
  return (
    <EmailLayout
      preview={`${daysRemaining} annual days remain in ${projectName} for ${year}`}
      title="Annual leave carry-over decision needed"
      intro={`Hi ${employeeName}, you still have unused annual leave in ${projectName} for ${year}.`}
      ctaLabel="Review carry-over options"
      ctaUrl={decisionUrl}
    >
      <EmailCallout tone="warning">
        Decide what happens to the remaining balance before the project year resets.
      </EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Year', value: String(year) },
          { label: 'Days remaining', value: String(daysRemaining) },
        ]}
      />
    </EmailLayout>
  );
}
