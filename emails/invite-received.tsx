import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type InviteReceivedEmailProps = {
  inviteeEmail: string;
  inviterName: string;
  projectName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
};

export function InviteReceivedEmail({
  inviteeEmail,
  inviterName,
  projectName,
  role,
  inviteUrl,
  expiresAt,
}: InviteReceivedEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${projectName} on BloomieVacation`}
      title="You are invited to join a team"
      intro={`${inviterName} added you to ${projectName}. Accept the invite to see the team calendar, balances, and leave requests.`}
      ctaLabel="Accept invitation"
      ctaUrl={inviteUrl}
      footerNote={`This invite was sent to ${inviteeEmail} and expires on ${expiresAt}.`}
    >
      <EmailCallout>
        {`You will join as a ${role}. If you already have a BloomieVacation account, sign in with this email address before accepting.`}
      </EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Project', value: projectName },
          { label: 'Role', value: role },
          { label: 'Invited by', value: inviterName },
          { label: 'Expires', value: expiresAt },
        ]}
      />
    </EmailLayout>
  );
}
