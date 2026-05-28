'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FolderKanban,
  Settings,
  ShieldCheck,
  UserX,
  Link2,
  Plus,
  CalendarPlus,
  MailPlus,
  BarChart3,
} from 'lucide-react';
import { RemoteImage } from '@/components/ui/remote-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';
import { defaultProjectSlugForNewLeave } from '@/lib/projects/leave-request-cta';
import { BloomLogo } from '@/components/ui/bloom-logo';
import { Badge } from '@/components/ui/badge';

type Project = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  role: 'admin' | 'lead' | 'employee';
};

export function Sidebar({
  projects,
  isSystemAdmin,
  className,
  onNavigate,
}: {
  projects: Project[];
  isSystemAdmin: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const leaveSlug = useMemo(
    () => defaultProjectSlugForNewLeave(projects, pathname),
    [projects, pathname]
  );

  const navItems: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
  }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/calendar', label: 'My calendar', icon: CalendarDays },
    { href: '/jira-analytics', label: 'JIRA ANALYTICS', icon: BarChart3 },
    { href: '/profile', label: 'Profile', icon: Users, exact: true },
    { href: '/profile/leave-approval-forwarding', label: 'Approval email copies', icon: MailPlus },
  ];

  const adminItems = [
    { href: '/admin/jira-settings', label: 'Jira settings', icon: Link2 },
    { href: '/admin/holidays', label: 'Holidays', icon: ShieldCheck },
    { href: '/admin/users-without-projects', label: 'Users without projects', icon: UserX },
  ];

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-r border-border bg-card',
        className
      )}
    >
      <div className="border-b border-border px-4 py-5 sm:px-5">
        <Link href="/dashboard" onClick={onNavigate} className="block max-w-full">
          <BloomLogo size={48} showText />
        </Link>
      </div>

      {leaveSlug ? (
        <div className="border-b border-border px-3 pb-4 pt-1">
          <Button asChild className="w-full font-semibold shadow-md" size="default">
            <Link href={projectPath(leaveSlug, 'requests', 'new')} onClick={onNavigate}>
              <CalendarPlus className="h-4 w-4" />
              Request leave
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border-b border-border px-3 pb-4 pt-1">
          <Button asChild variant="outline" className="w-full text-sm" size="sm">
            <Link href="/projects" onClick={onNavigate}>
              Browse projects to request leave
            </Link>
          </Button>
        </div>
      )}

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navigate
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {projects.length > 0 && (
          <div>
            <p className="mb-2 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Projects</span>
              {isSystemAdmin && (
                <Link
                  href="/projects/new"
                  onClick={onNavigate}
                  className="rounded p-1 hover:bg-accent"
                  aria-label="New project"
                >
                  <Plus className="h-3 w-3" />
                </Link>
              )}
            </p>
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const base = `/projects/${p.slug}`;
                const isActive = pathname === base || pathname.startsWith(`${base}/`);
                return (
                  <li key={p.id}>
                    <Link
                      href={projectPath(p.slug)}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      {p.logo_url ? (
                        <RemoteImage
                          src={p.logo_url}
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-medium text-primary">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.role !== 'employee' && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] font-mono uppercase"
                        >
                          {p.role}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isSystemAdmin && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              System
            </p>
            <ul className="space-y-0.5">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className="border-t border-border px-5 py-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-3 w-3" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
