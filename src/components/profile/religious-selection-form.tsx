'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type HolidayOption = {
  id: string;
  name: string;
  date: string;
  category: string;
  createdBy?: string | null;
};

type SelectedHoliday = {
  id: string;
  name: string;
  date: string;
  category: string;
  isCustom: boolean;
};

export function ReligiousSelectionForm({
  year,
  holidays,
  selectedIds,
  selectedHolidays,
  currentUserId,
}: {
  year: number;
  holidays: HolidayOption[];
  selectedIds: string[];
  selectedHolidays: SelectedHoliday[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [isSaving, setIsSaving] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  function toggleHoliday(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function saveSelections() {
    setIsSaving(true);
    const response = await fetch('/api/profile/religious-selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, holidayIds: selected }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to save selections');
    toast.success('Religious holidays saved for this year');
    router.refresh();
  }

  async function addCustomHoliday() {
    if (!customName.trim() || !customDate) {
      return toast.error('Enter a holiday name and date');
    }

    setIsAddingCustom(true);
    const response = await fetch('/api/profile/custom-religious-holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year,
        name: customName.trim(),
        date: customDate,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsAddingCustom(false);

    if (!response.ok) return toast.error(payload.error || 'Failed to add custom holiday');

    toast.success('Custom holiday added to your profile');
    setCustomName('');
    setCustomDate('');
    if (payload.holiday?.id) {
      setSelected((current) =>
        current.includes(payload.holiday.id) ? current : [...current, payload.holiday.id]
      );
    }
    router.refresh();
  }

  const customHolidays = holidays.filter((holiday) => holiday.createdBy === currentUserId);
  const poolHolidays = holidays.filter((holiday) => holiday.createdBy !== currentUserId);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="font-medium">Selected for {year}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          These holidays are saved on your profile for this year.
        </p>
        {selectedHolidays.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No holidays selected yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedHolidays.map((holiday) => (
              <li
                key={holiday.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="text-muted-foreground">{holiday.date}</p>
                </div>
                {holiday.isCustom ? <Badge variant="outline">Custom</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="font-medium">Add custom holiday</h3>
          <p className="text-sm text-muted-foreground">
            Add a personal religious holiday and save it directly to your profile.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="space-y-2">
            <Label htmlFor="custom-holiday-name">Holiday name</Label>
            <Input
              id="custom-holiday-name"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Holiday name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-holiday-date">Date</Label>
            <Input
              id="custom-holiday-date"
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={addCustomHoliday} disabled={isAddingCustom}>
              Add custom holiday
            </Button>
          </div>
        </div>
      </div>

      {customHolidays.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-medium">Your custom holidays</h3>
          <div className="grid gap-2">
            {customHolidays.map((holiday) => (
              <label
                key={holiday.id}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{holiday.name}</span>
                  <span className="ml-2 text-muted-foreground">{holiday.date}</span>
                </span>
                <input
                  type="checkbox"
                  checked={selected.includes(holiday.id)}
                  onChange={() => toggleHoliday(holiday.id)}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="font-medium">Holiday pool</h3>
        <div className="grid gap-2">
          {poolHolidays.map((holiday) => (
            <label
              key={holiday.id}
              className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{holiday.name}</span>
                <span className="ml-2 text-muted-foreground">{holiday.date}</span>
              </span>
              <input
                type="checkbox"
                checked={selected.includes(holiday.id)}
                onChange={() => toggleHoliday(holiday.id)}
              />
            </label>
          ))}
        </div>
      </div>

      <Button type="button" onClick={saveSelections} disabled={isSaving}>
        Save {year} selections
      </Button>
    </div>
  );
}
