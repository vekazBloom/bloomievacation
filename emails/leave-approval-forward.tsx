import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type ApprovalForwardFundBalanceRow = {
  fundName: string;
  fundPool: number;
  daysThisRequest: number;
  usedOnFund: number;
  remaining: number;
};

export type LeaveApprovalForwardEmailProps = {
  approverName: string;
  employeeName: string;
  employeeEmail: string;
  projectNames: string;
  leaveTypeLabel: string;
  workingDays: number;
  dateRange: string;
  remainingSummary: string;
  balanceLabel: string;
  fundBalances?: ApprovalForwardFundBalanceRow[];
};

function formatDays(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(1);
}

export function LeaveApprovalForwardEmail({
  approverName,
  employeeName,
  employeeEmail,
  projectNames,
  leaveTypeLabel,
  workingDays,
  dateRange,
  remainingSummary,
  balanceLabel,
  fundBalances = [],
}: LeaveApprovalForwardEmailProps) {
  const detailRows: { label: string; value: string }[] = [
    { label: 'Employee', value: employeeName },
    { label: 'Employee email', value: employeeEmail },
    { label: 'Project(s)', value: projectNames },
    { label: 'Leave type', value: leaveTypeLabel },
    { label: 'Working days requested', value: String(workingDays) },
    { label: 'Dates', value: dateRange },
    { label: 'Approved by', value: approverName },
  ];

  if (fundBalances.length > 0) {
    for (const fund of fundBalances) {
      detailRows.push(
        { label: 'Annual fund', value: `${fund.fundName} (${formatDays(fund.fundPool)} days)` },
        {
          label: 'Days from this approval',
          value: `${formatDays(fund.daysThisRequest)} day(s) deducted from this fund`,
        },
        {
          label: 'Remaining on fund',
          value: `${formatDays(fund.remaining)} of ${formatDays(fund.fundPool)} days`,
        }
      );
    }
  } else {
    detailRows.push({ label: balanceLabel, value: remainingSummary });
  }

  return (
    <EmailLayout
      preview={`${employeeName} — ${leaveTypeLabel} approved (${workingDays} day${workingDays === 1 ? '' : 's'})`}
      title="Leave approved (copy)"
      intro={`${approverName} approved a ${leaveTypeLabel} request for ${employeeName}.`}
    >
      <EmailCallout tone="success">This is an automatic copy for your records.</EmailCallout>
      <EmailDetails rows={detailRows} />
    </EmailLayout>
  );
}
