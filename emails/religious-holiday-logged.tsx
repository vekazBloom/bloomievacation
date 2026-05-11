import { EmailCallout, EmailDetails, EmailLayout } from './components/email-layout';

export type ReligiousHolidayLoggedEmailProps = {
  managerName: string;
  employeeName: string;
  projectName: string;
  holidayName: string;
  holidayDate: string;
  calendarUrl: string;
};

export function ReligiousHolidayLoggedEmail({
  managerName,
  employeeName,
  projectName,
  holidayName,
  holidayDate,
  calendarUrl,
}: ReligiousHolidayLoggedEmailProps) {
  return (
    <EmailLayout
      preview={`${employeeName} logged ${holidayName} in ${projectName}`}
      title="Religious holiday recorded"
      intro={`Hi ${managerName}, ${employeeName} logged a religious holiday in ${projectName}.`}
      ctaLabel="Open team calendar"
      ctaUrl={calendarUrl}
    >
      <EmailCallout tone="success">
        Religious holidays are auto-approved and should already appear on the team calendar.
      </EmailCallout>
      <EmailDetails
        rows={[
          { label: 'Employee', value: employeeName },
          { label: 'Project', value: projectName },
          { label: 'Holiday', value: holidayName },
          { label: 'Date', value: holidayDate },
        ]}
      />
    </EmailLayout>
  );
}
