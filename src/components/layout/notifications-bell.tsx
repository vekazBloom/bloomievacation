'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Notification = {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/notifications')
      .then((response) => response.json())
      .then((payload) => setNotifications(payload.notifications || []));
  }, [open]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
    );
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Notifications</p>
            <Button type="button" size="sm" variant="ghost" onClick={markAllRead}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{item.title}</p>
                  {item.message ? <p className="text-muted-foreground">{item.message}</p> : null}
                  {item.link ? (
                    <Link href={item.link} className="text-xs text-primary hover:underline">
                      Open
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
