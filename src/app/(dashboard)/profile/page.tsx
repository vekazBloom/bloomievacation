import { ReligiousSelectionForm } from '@/components/profile/religious-selection-form';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { RemoteImage } from '@/components/ui/remote-image';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/utils';

export default async function ProfilePage() {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;

  const { data: memberships } = await supabase
    .from('project_members')
    .select('role, projects(id, name, logo_url)')
    .eq('user_id', user.id);

  const year = new Date().getFullYear();
  const { data: religiousHolidays } = await supabase
    .from('religious_holidays_pool')
    .select('id, name, date, category, created_by')
    .order('date', { ascending: true });

  const { data: selections } = await supabase
    .from('user_religious_selections')
    .select('religious_holiday_id, religious_holidays_pool(id, name, date, category, created_by)')
    .eq('user_id', user.id)
    .eq('year', year);

  const selectedHolidays = (selections || [])
    .map((selection: any) => selection.religious_holidays_pool)
    .filter(Boolean)
    .map((holiday: any) => ({
      id: holiday.id,
      name: holiday.name,
      date: holiday.date,
      category: holiday.category,
      isCustom: holiday.created_by === user.id,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal info, religious preferences, and notifications.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.name} />
              )}
              <AvatarFallback className="text-lg">
                {getInitials(profile?.name || user.email!)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-display text-2xl">{profile?.name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profile?.is_system_admin && (
                <Badge variant="secondary" className="mt-2 font-mono uppercase">
                  System Administrator
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Your projects</h2>
          <p className="text-sm text-muted-foreground">Where you currently have access.</p>
        </div>
        <CardContent className="p-0">
          {(memberships || []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              You haven&apos;t joined any project yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(memberships || []).map((m: any) => (
                <li key={m.projects.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.projects.logo_url ? (
                      <RemoteImage
                        src={m.projects.logo_url}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-medium text-primary">
                        {m.projects.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-sm font-medium">{m.projects.name}</span>
                  </div>
                  <Badge variant="outline" className="font-mono uppercase">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Religious holidays</h2>
          <p className="text-sm text-muted-foreground">
            Pick the holidays you observe for {year}. Approved leave is created automatically.
          </p>
        </div>
        <CardContent className="p-6">
          <ReligiousSelectionForm
            year={year}
            holidays={religiousHolidays || []}
            selectedIds={(selections || []).map((item) => item.religious_holiday_id)}
            selectedHolidays={selectedHolidays}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
