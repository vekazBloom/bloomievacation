import { AdminDashboardOverview } from '@/components/dashboard/admin-dashboard-overview';
import {
  fetchAdminProjectCounts,
  fetchAdminProjectCountsFallback,
} from '@/lib/admin/project-overview';
import { getDashboardSession } from '@/lib/auth/dashboard';

export async function DashboardAdminOverviewSection() {
  const session = await getDashboardSession();
  if (!session?.profile.is_system_admin) {
    return null;
  }

  const { supabase, profile } = session;
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, slug, description, logo_url')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  const projectIds = (projects || []).map((project) => project.id);
  if (projectIds.length === 0) {
    return (
      <AdminDashboardOverview
        profile={{
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        }}
        projects={[]}
      />
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().split('T')[0];

  let countRows;
  try {
    countRows = await fetchAdminProjectCounts(supabase, today, weekEndIso);
  } catch {
    countRows = await fetchAdminProjectCountsFallback(supabase, projectIds, today, weekEndIso);
  }

  const countByProjectId = new Map(countRows.map((row) => [row.project_id, row]));
  const adminProjects = (projects || []).map((project) => {
    const counts = countByProjectId.get(project.id);

    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      logo_url: project.logo_url,
      memberCount: Number(counts?.member_count || 0),
      pendingCount: Number(counts?.pending_count || 0),
      awayThisWeekCount: Number(counts?.away_this_week_count || 0),
    };
  });

  return (
    <AdminDashboardOverview
      profile={{
        name: profile.name,
        email: profile.email,
        avatar_url: profile.avatar_url,
      }}
      projects={adminProjects}
    />
  );
}
