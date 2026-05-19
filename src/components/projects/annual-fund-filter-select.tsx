'use client';

import { Label } from '@/components/ui/label';
import type { AnnualFundDefinitionOption } from '@/lib/projects/overview-fund-stats';

export const ALL_ANNUAL_FUNDS = 'all';

const selectClassName =
  'flex h-9 min-w-[10rem] max-w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function AnnualFundFilterSelect({
  id,
  value,
  definitions,
  onChange,
}: {
  id: string;
  value: string;
  definitions: AnnualFundDefinitionOption[];
  onChange: (value: string) => void;
}) {
  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5 shrink-0">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Annual fund
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        <option value={ALL_ANNUAL_FUNDS}>All funds</option>
        {definitions.map((definition) => (
          <option key={definition.id} value={definition.id}>
            {definition.label}
          </option>
        ))}
      </select>
    </div>
  );
}
