'use client';

import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NotificationsBell } from '@/components/layout/notifications-bell';

type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_system_admin: boolean;
};

export function TopBar({
  profile,
  onOpenMenu,
}: {
  profile: Profile;
  onOpenMenu?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-3 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="hidden text-sm text-muted-foreground lg:block">
        <span className="font-display text-base text-foreground">
          Hello, {profile.name.split(' ')[0]}
        </span>
        <span className="ml-2">— have a restful day.</span>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />

        <Link href="/profile" className="flex items-center gap-2 rounded-md p-1 hover:bg-accent">
          <Avatar className="h-8 w-8">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name} />}
            <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-tight">{profile.name}</p>
            <div className="text-xs text-muted-foreground leading-tight">
              {profile.is_system_admin ? (
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-mono uppercase">
                  System Admin
                </Badge>
              ) : (
                profile.email
              )}
            </div>
          </div>
        </Link>

        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
