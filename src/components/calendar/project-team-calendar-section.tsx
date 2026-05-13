import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { getNationalHolidays } from '@/lib/holidays/national';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

export async function ProjectTeamCalendarSection({ slug }: { slug: string }) {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase, user, profile } = session;
  const { project } = await getProjectBySlug(supabase, slug);
  if (!project) {
    return null;
  }

  const projectId = project.id;

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [{ data: members }, holidays] = await Promise.all([
    supabase.from('project_members').select('user_id, users(id, name)').eq('project_id', projectId),
    getNationalHolidays(),
  ]);

  const memberUserIds = [
    ...new Set(
      (members || [])
        .map((row: { user_id?: string }) => row.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: requests } =
    memberUserIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select(
            `id, user_id, project_id, type, status, start_date, end_date, ${leaveRequestUserEmbed}(name, avatar_url), projects(name, slug)`
          )
          .in('user_id', memberUserIds)
          .in('status', ['pending', 'approved'])
      : { data: [] };

  const requestRows = requests || [];

  const requestProjectIds = [
    ...new Set(
      requestRows.map((r: { project_id?: string }) => r.project_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const reviewableProjectIds = new Set<string>();
  if (requestProjectIds.length > 0) {
    if (profile.is_system_admin) {
      requestProjectIds.forEach((id) => reviewableProjectIds.add(id));
    } else {
      const { data: reviewMemberships } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', user.id)
        .in('project_id', requestProjectIds);

      for (const row of reviewMemberships || []) {
        if (row.role === 'admin' || row.role === 'lead') {
          reviewableProjectIds.add(row.project_id);
        }
      }
    }
  }

  const schedulerMembers = (members || [])
    .map((row: { users?: { id: string; name: string } | { id: string; name: string }[] | null }) => {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!u?.id || !u?.name) return null;
      return { id: u.id, name: u.name };
    })
    .filter((member): member is { id: string; name: string } => Boolean(member));

  const events = [
    ...requestRows.map((request) =>
      mapLeaveRequestToEvent(request, {
        viewingProjectId: project.id,
        canReviewThisRequest: Boolean(request.project_id && reviewableProjectIds.has(request.project_id)),
      })
    ),
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  const canReview = canReviewLeaveForRole(profile.is_system_admin, membership.role);

  return (
    <TeamScheduler
      events={events}
      members={schedulerMembers}
      canReview={canReview}
      projectSlug={project.slug}
    />
  );
}
