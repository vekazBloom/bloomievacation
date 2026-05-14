import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type InviteReceivedEmailProps = {
  inviteeEmail: string;
  inviterName: string;
  /** Null when the invite is not tied to a specific project. */
  projectName: string | null;
  /** Shown in the header (project name or app name). */
  displayName: string;
  roleSummary: string;
  inviteUrl: string;
  expiresAt: string;
};

export function InviteReceivedEmail({
  inviteeEmail,
  inviterName,
  projectName,
  displayName,
  roleSummary,
  inviteUrl,
  expiresAt,
}: InviteReceivedEmailProps) {
  const preview = projectName
    ? `${inviterName} invited you to ${projectName} on BloomieVacation`
    : `${inviterName} invited you to BloomieVacation`;

  return (
    <EmailLayout
      preview={preview}
      title={`Join ${displayName}`}
      intro={
        projectName
          ? `${inviterName} added you to ${projectName}. Accept the invite to see the team calendar, balances, and leave requests.`
          : `${inviterName} invited you to BloomieVacation. Accept the invite to create your account and open the app.`
      }
      ctaLabel="Accept invitation"
      ctaUrl={inviteUrl}
      footerNote={`This invite was sent to ${inviteeEmail} and expires on ${expiresAt}.`}
    >
      <EmailCallout>
        {`You will join as: ${roleSummary}. If you already have a BloomieVacation account, sign in with this email address before accepting.`}
      </EmailCallout>
      <EmailDetails
        rows={[
          ...(projectName ? [{ label: 'Project', value: projectName }] : []),
          { label: 'Access', value: roleSummary },
          { label: 'Invited by', value: inviterName },
          { label: 'Expires', value: expiresAt },
        ]}
      />
    </EmailLayout>
  );
}
