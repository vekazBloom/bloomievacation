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

  const [{ data: requests }, { data: members }, holidays] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(`id, user_id, type, status, start_date, end_date, ${leaveRequestUserEmbed}(name, avatar_url)`)
      .eq('project_id', projectId)
      .in('status', ['pending', 'approved']),
    supabase.from('project_members').select('users(id, name)').eq('project_id', projectId),
    getNationalHolidays(),
  ]);

  const schedulerMembers = (members || [])
    .map((member: { users?: { id: string; name: string } | { id: string; name: string }[] | null }) =>
      Array.isArray(member.users) ? member.users[0] : member.users
    )
    .filter((member): member is { id: string; name: string } => Boolean(member?.id && member?.name))
    .map((member) => ({ id: member.id, name: member.name }));

  const events = [
    ...(requests || []).map((request) => mapLeaveRequestToEvent(request)),
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
