'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  initialPhone: string | null;
  botUsername?: string | null;
};

export function PhoneForm({ initialPhone, botUsername }: Props) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone ?? '');
  const [isLoading, setIsLoading] = useState(!initialPhone);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialPhone !== null) return;
    async function loadPhone() {
      const response = await fetch('/api/profile/phone');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setIsLoading(false);
        return;
      }
      setPhoneNumber(payload.phoneNumber ?? '');
      setIsLoading(false);
    }
    void loadPhone();
  }, [initialPhone]);

  async function savePhone() {
    setIsSaving(true);
    const response = await fetch('/api/profile/phone', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber.trim() || null }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) {
      return toast.error(payload.error || 'Spremanje broja telefona nije uspjelo.');
    }
    setPhoneNumber(payload.phoneNumber ?? '');
    toast.success('Broj telefona je spremljen.');
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone-number">Broj telefona</Label>
        <Input
          id="phone-number"
          type="tel"
          placeholder="+387 61 123 456"
          value={phoneNumber}
          disabled={isLoading || isSaving}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Koristi se za povezivanje Telegram bota. Broj mora odgovarati broju na vašem Telegram
          računu.
        </p>
      </div>
      <Button type="button" disabled={isLoading || isSaving} onClick={() => void savePhone()}>
        {isSaving ? 'Spremanje…' : 'Spremi broj'}
      </Button>
      {botUsername ? (
        <p className="text-sm text-muted-foreground">
          Nakon spremanja, otvorite{' '}
          <a
            href={`https://t.me/${botUsername.replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            @{botUsername.replace('@', '')}
          </a>{' '}
          i podijelite kontakt kada bot zatraži.
        </p>
      ) : null}
    </div>
  );
}
