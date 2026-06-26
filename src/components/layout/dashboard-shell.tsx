'use client';

import { useState } from 'react';
import { ChatWidget } from '@/components/chat/chat-widget';
import { Sidebar } from '@/components/layout/sidebar';
import { SessionInvitationSync } from '@/components/layout/session-invitation-sync';
import { TopBar } from '@/components/layout/top-bar';

type Project = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  role: 'admin' | 'lead' | 'employee';
};

type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_system_admin: boolean;
};

export function DashboardShell({
  children,
  profile,
  projects,
  isSystemAdmin,
}: {
  children: React.ReactNode;
  profile: Profile;
  projects: Project[];
  isSystemAdmin: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <SessionInvitationSync userId={profile.id} />
      <Sidebar
        projects={projects}
        isSystemAdmin={isSystemAdmin}
        className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex"
      />

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <Sidebar
            projects={projects}
            isSystemAdmin={isSystemAdmin}
            className="relative flex h-full w-64 shrink-0 flex-col border-r border-border bg-card shadow-xl"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col">
        <TopBar
          profile={profile}
          projects={projects}
          onOpenMenu={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
      <ChatWidget userId={profile.id} userName={profile.name} />
    </div>
  );
}
