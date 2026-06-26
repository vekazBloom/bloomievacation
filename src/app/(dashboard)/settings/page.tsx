'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PhoneForm } from '@/components/profile/phone-form';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      const response = await fetch('/api/profile/notification-preferences');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setIsLoading(false);
        return toast.error(payload.error || 'Failed to load notification preferences');
      }
      setEmailNotifications(payload.emailNotificationsEnabled !== false);
      setIsLoading(false);
    }

    void loadPreferences();
  }, []);

  async function updatePreference(value: boolean) {
    setEmailNotifications(value);
    setIsSaving(true);
    const response = await fetch('/api/profile/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailNotificationsEnabled: value }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) {
      setEmailNotifications(!value);
      return toast.error(payload.error || 'Failed to save notification preferences');
    }
    toast.success('Notification preferences saved');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage account notification preferences stored on your profile.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <Label className="flex items-center justify-between gap-4">
            <span>Email notifications</span>
            <input
              type="checkbox"
              checked={emailNotifications}
              disabled={isLoading || isSaving}
              onChange={(event) => updatePreference(event.target.checked)}
            />
          </Label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-lg">Telegram bot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Phone number for linking your Telegram account.
            </p>
          </div>
          <PhoneForm botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
