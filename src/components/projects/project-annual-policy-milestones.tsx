'use client';

import { useMemo } from 'react';
import {
  formatPolicyDate,
  milestoneForMonthDay,
} from '@/lib/leave/annual-policy-dates';

type Props = {
  /** Draft or saved month/day (1–12 / 1–31) */
  yearResetMonth: number;
  yearResetDay: number;
  annualAccrualMonth: number;
  annualAccrualDay: number;
  annualFirstUseByMonth: number | null;
  annualFirstUseByDay: number | null;
  locale?: string;
};

function clampMd(m: number, d: number) {
  const month = Number.isFinite(m) ? Math.min(12, Math.max(1, Math.trunc(m))) : 1;
  const day = Number.isFinite(d) ? Math.min(31, Math.max(1, Math.trunc(d))) : 1;
  return { month, day };
}

export function ProjectAnnualPolicyMilestones({
  yearResetMonth,
  yearResetDay,
  annualAccrualMonth,
  annualAccrualDay,
  annualFirstUseByMonth,
  annualFirstUseByDay,
  locale,
}: Props) {
  const { nextReset, nextAccrual } = useMemo(() => {
    const from = new Date();
    const rm = clampMd(yearResetMonth, yearResetDay);
    const am = clampMd(annualAccrualMonth, annualAccrualDay);
    return {
      nextReset: milestoneForMonthDay(rm.month, rm.day, from),
      nextAccrual: milestoneForMonthDay(am.month, am.day, from),
    };
  }, [yearResetMonth, yearResetDay, annualAccrualMonth, annualAccrualDay]);

  const firstUseNote =
    annualFirstUseByMonth != null &&
    annualFirstUseByDay != null &&
    Number.isFinite(annualFirstUseByMonth) &&
    Number.isFinite(annualFirstUseByDay) ? (
      <p className="text-xs text-muted-foreground">
        Funds created by the year-reset job get a use-by date on{' '}
        <span className="font-medium text-foreground">
          {annualFirstUseByMonth}/{annualFirstUseByDay}
        </span>{' '}
        in the <span className="font-medium text-foreground">following calendar year</span> (per fund
        year). See the team funds table below for each member&apos;s actual windows.
      </p>
    ) : null;

  return (
    <div className="rounded-lg border border-border bg-muted/25 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Upcoming (from today)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dates update as you edit month/day fields. The reset date is when the year-reset job runs;
          accrual month/day is stored on each new fund as <code className="text-xs">valid_from</code>.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 text-sm">
        <li className="rounded-md border border-border bg-card px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next year reset
          </div>
          <div className="mt-1 font-medium">{formatPolicyDate(nextReset.date, locale)}</div>
          <div className="text-xs text-muted-foreground">
            {nextReset.daysUntil === 0 ? 'Today' : `In ${nextReset.daysUntil} day(s)`} · {nextReset.iso}
          </div>
        </li>
        <li className="rounded-md border border-border bg-card px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next accrual calendar date
          </div>
          <div className="mt-1 font-medium">{formatPolicyDate(nextAccrual.date, locale)}</div>
          <div className="text-xs text-muted-foreground">
            {nextAccrual.daysUntil === 0 ? 'Today' : `In ${nextAccrual.daysUntil} day(s)`} · {nextAccrual.iso}
          </div>
        </li>
      </ul>
      {firstUseNote}
    </div>
  );
}
