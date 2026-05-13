'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { CalendarPlus, LogOut, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { defaultProjectSlugForNewLeave } from '@/lib/projects/leave-request-cta';
import { projectPath } from '@/lib/projects/paths';

type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_system_admin: boolean;
};

type ShellProject = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  role: 'admin' | 'lead' | 'employee';
};

export function TopBar({
  profile,
  projects,
  onOpenMenu,
}: {
  profile: Profile;
  projects: ShellProject[];
  onOpenMenu?: () => void;
}) {
  const pathname = usePathname();
  const leaveSlug = useMemo(
    () => defaultProjectSlugForNewLeave(projects, pathname),
    [projects, pathname]
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:min-w-0 lg:flex-none lg:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="shrink-0 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {leaveSlug ? (
          <Button
            asChild
            size="sm"
            className="shrink-0 shadow-sm lg:hidden"
            aria-label="Request leave"
          >
            <Link href={projectPath(leaveSlug, 'requests', 'new')}>
              <CalendarPlus className="h-4 w-4" />
              <span className="max-w-[9.5rem] truncate sm:max-w-none">Request leave</span>
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="shrink-0 text-xs lg:hidden">
            <Link href="/projects">
              <span className="max-w-[6rem] truncate sm:max-w-none">Projects</span>
            </Link>
          </Button>
        )}
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
        <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          <span className="font-display text-base text-foreground">
            Hello, {profile.name.split(' ')[0]}
          </span>
          <span className="ml-2">— have a restful day.</span>
        </div>
        {leaveSlug ? (
          <Button asChild size="sm" className="shrink-0 shadow-sm">
            <Link href={projectPath(leaveSlug, 'requests', 'new')}>
              <CalendarPlus className="h-4 w-4" />
              Request leave
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/projects">Browse projects</Link>
          </Button>
        )}
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
