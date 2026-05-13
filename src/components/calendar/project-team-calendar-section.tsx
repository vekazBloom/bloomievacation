import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { mapHolidayToEvent, mapLeaveRequestToEvent, type LeaveRequestRow } from '@/lib/calendar/map-events';
import { getNationalHolidays } from '@/lib/holidays/national';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

function getProjectNameFromRow(request: LeaveRequestRow) {
  const p = request.projects;
  const project = Array.isArray(p) ? p[0] : p;
  return project?.name ?? null;
}

function mapRequestToSchedulerEvent(
  request: LeaveRequestRow,
  projectViewId: string,
  reviewableProjectIds: Set<string>
) {
  return mapLeaveRequestToEvent(request, {
    viewingProjectId: projectViewId,
    canReviewThisRequest: Boolean(request.project_id && reviewableProjectIds.has(request.project_id)),
  });
}

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
            `id, user_id, project_id, type, status, start_date, end_date, reason, ${leaveRequestUserEmbed}(name, avatar_url), projects(name, slug)`
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

  const typedRows = requestRows as LeaveRequestRow[];

  const groupedReligious = new Map<string, { request: LeaveRequestRow; projectNames: Set<string> }>();
  const nonReligious = typedRows.filter((r) => r.type !== 'religious');

  for (const request of typedRows) {
    if (request.type !== 'religious') continue;
    const key = `${request.user_id || 'unknown'}|${request.start_date}|${request.end_date}|${request.status || 'approved'}|${request.reason ?? ''}`;
    const existing = groupedReligious.get(key);
    const projectName = getProjectNameFromRow(request);
    if (existing) {
      if (projectName) existing.projectNames.add(projectName);
      continue;
    }
    groupedReligious.set(key, {
      request,
      projectNames: new Set(projectName ? [projectName] : []),
    });
  }

  const mergedReligious = Array.from(groupedReligious.values()).map(({ request, projectNames }) => {
    const projectCount = projectNames.size;
    if (projectCount <= 1) {
      return mapRequestToSchedulerEvent(request, project.id, reviewableProjectIds);
    }
    const names = [...projectNames].sort().join(', ');
    return mapLeaveRequestToEvent(request, {
      viewingProjectId: project.id,
      subtitle: `${names} · ${request.type} · ${request.status || 'approved'}`,
      canReviewThisRequest: Boolean(request.project_id && reviewableProjectIds.has(request.project_id)),
    });
  });

  const events = [
    ...nonReligious.map((request) => mapRequestToSchedulerEvent(request, project.id, reviewableProjectIds)),
    ...mergedReligious,
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
