'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type NationalHoliday = {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  description?: string | null;
};

type ReligiousHoliday = {
  id: string;
  name: string;
  date: string;
  category: string;
  is_recurring: boolean;
  description?: string | null;
};

const RELIGIOUS_CATEGORIES = [
  { value: 'islam', label: 'Islam' },
  { value: 'christianity_catholic', label: 'Christianity (Catholic)' },
  { value: 'christianity_orthodox', label: 'Christianity (Orthodox)' },
  { value: 'judaism', label: 'Judaism' },
  { value: 'hinduism', label: 'Hinduism' },
  { value: 'buddhism', label: 'Buddhism' },
  { value: 'other', label: 'Other' },
];

function NationalHolidayRow({ holiday }: { holiday: NationalHoliday }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(holiday.name);
  const [date, setDate] = useState(holiday.date);
  const [description, setDescription] = useState(holiday.description || '');
  const [isRecurring, setIsRecurring] = useState(holiday.is_recurring);
  const [isSaving, setIsSaving] = useState(false);

  async function saveHoliday() {
    setIsSaving(true);
    const response = await fetch(`/api/admin/national-holidays/${holiday.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date,
        description: description || null,
        is_recurring: isRecurring,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to update holiday');
    toast.success('National holiday updated');
    setIsEditing(false);
    router.refresh();
  }

  async function deleteHoliday() {
    const response = await fetch(`/api/admin/national-holidays/${holiday.id}`, { method: 'DELETE' });
    if (!response.ok) return toast.error('Failed to delete holiday');
    toast.success('National holiday removed');
    router.refresh();
  }

  if (!isEditing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div>
          <p className="font-medium">{holiday.name}</p>
          <p className="text-xs text-muted-foreground">
            {holiday.date}
            {holiday.is_recurring ? ' · Recurring' : ''}
            {holiday.description ? ` · ${holiday.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={deleteHoliday}>
            Delete
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-3 py-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Holiday name" />
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="md:col-span-2"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(event) => setIsRecurring(event.target.checked)}
        />
        Recurring every year
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={saveHoliday} disabled={isSaving}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    </li>
  );
}

function ReligiousHolidayRow({ holiday }: { holiday: ReligiousHoliday }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(holiday.name);
  const [date, setDate] = useState(holiday.date);
  const [category, setCategory] = useState(holiday.category);
  const [description, setDescription] = useState(holiday.description || '');
  const [isRecurring, setIsRecurring] = useState(holiday.is_recurring);
  const [isSaving, setIsSaving] = useState(false);

  async function saveHoliday() {
    setIsSaving(true);
    const response = await fetch(`/api/admin/religious-holidays/${holiday.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date,
        category,
        description: description || null,
        is_recurring: isRecurring,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) return toast.error(payload.error || 'Failed to update holiday');
    toast.success('Religious holiday updated');
    setIsEditing(false);
    router.refresh();
  }

  async function deleteHoliday() {
    const response = await fetch(`/api/admin/religious-holidays/${holiday.id}`, { method: 'DELETE' });
    if (!response.ok) return toast.error('Failed to delete holiday');
    toast.success('Religious holiday removed');
    router.refresh();
  }

  if (!isEditing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div>
          <p className="font-medium">{holiday.name}</p>
          <p className="text-xs text-muted-foreground">
            {holiday.date}
            {holiday.is_recurring ? ' · Recurring' : ''}
            {holiday.description ? ` · ${holiday.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={deleteHoliday}>
            Delete
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-3 py-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Holiday name" />
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {RELIGIOUS_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="md:col-span-3"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(event) => setIsRecurring(event.target.checked)}
        />
        Recurring every year
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={saveHoliday} disabled={isSaving}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    </li>
  );
}

export function HolidaysAdminPanel({
  nationalHolidays,
  religiousHolidays,
}: {
  nationalHolidays: NationalHoliday[];
  religiousHolidays: ReligiousHoliday[];
}) {
  const router = useRouter();
  const [nationalName, setNationalName] = useState('');
  const [nationalDate, setNationalDate] = useState('');
  const [nationalDescription, setNationalDescription] = useState('');
  const [religiousName, setReligiousName] = useState('');
  const [religiousDate, setReligiousDate] = useState('');
  const [religiousCategory, setReligiousCategory] = useState('islam');
  const [religiousDescription, setReligiousDescription] = useState('');

  async function createNationalHoliday() {
    const response = await fetch('/api/admin/national-holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nationalName,
        date: nationalDate,
        description: nationalDescription || null,
        is_recurring: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || 'Failed to create holiday');
    toast.success('National holiday added');
    setNationalName('');
    setNationalDate('');
    setNationalDescription('');
    router.refresh();
  }

  async function createReligiousHoliday() {
    const response = await fetch('/api/admin/religious-holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: religiousName,
        date: religiousDate,
        category: religiousCategory,
        description: religiousDescription || null,
        is_recurring: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || 'Failed to create holiday');
    toast.success('Religious holiday added');
    setReligiousName('');
    setReligiousDate('');
    setReligiousDescription('');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-medium">National holidays</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <Input value={nationalName} onChange={(e) => setNationalName(e.target.value)} placeholder="Holiday name" />
          <Input type="date" value={nationalDate} onChange={(e) => setNationalDate(e.target.value)} />
          <Button type="button" onClick={createNationalHoliday}>Add</Button>
        </div>
        <Input
          value={nationalDescription}
          onChange={(e) => setNationalDescription(e.target.value)}
          placeholder="Description (optional)"
          className="mt-3"
        />
        <ul className="mt-4 divide-y divide-border">
          {nationalHolidays.map((holiday) => (
            <NationalHolidayRow key={holiday.id} holiday={holiday} />
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 font-medium">Religious holidays pool</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <Input value={religiousName} onChange={(e) => setReligiousName(e.target.value)} placeholder="Holiday name" />
          <Input type="date" value={religiousDate} onChange={(e) => setReligiousDate(e.target.value)} />
          <select
            value={religiousCategory}
            onChange={(e) => setReligiousCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {RELIGIOUS_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" onClick={createReligiousHoliday}>Add</Button>
        </div>
        <Input
          value={religiousDescription}
          onChange={(e) => setReligiousDescription(e.target.value)}
          placeholder="Description (optional)"
          className="mt-3"
        />
        <ul className="mt-4 divide-y divide-border">
          {religiousHolidays.map((holiday) => (
            <ReligiousHolidayRow key={holiday.id} holiday={holiday} />
          ))}
        </ul>
      </div>
    </div>
  );
}
