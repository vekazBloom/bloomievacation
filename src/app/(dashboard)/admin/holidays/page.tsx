import { redirect } from 'next/navigation';
import { HolidaysAdminPanel } from '@/components/admin/holidays-admin-panel';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function HolidaysPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_system_admin) redirect('/dashboard');

  const { data: nationalHolidays } = await supabase
    .from('national_holidays')
    .select('*')
    .order('date', { ascending: true });

  const { data: religiousHolidays } = await supabase
    .from('religious_holidays_pool')
    .select('*')
    .order('category', { ascending: true })
    .order('date', { ascending: true });

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Holidays</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add, edit, or remove national holidays and the religious holiday pool.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <HolidaysAdminPanel
            nationalHolidays={nationalHolidays || []}
            religiousHolidays={religiousHolidays || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
