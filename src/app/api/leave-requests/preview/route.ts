import { NextRequest, NextResponse } from 'next/server';
import { fetchAnnualGrantSplitHints } from '@/lib/leave/entitlement-grants';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get('projectId');
  const startDate = request.nextUrl.searchParams.get('startDate');
  const endDate = request.nextUrl.searchParams.get('endDate');
  const excludeRequestId = request.nextUrl.searchParams.get('excludeRequestId');
  const leaveType = request.nextUrl.searchParams.get('leaveType');

  if (!projectId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing query params' }, { status: 400 });
  }

  const { data: workingDays, error: workingDaysError } = await supabase.rpc(
    'calculate_working_days',
    { p_start: startDate, p_end: endDate }
  );

  if (workingDaysError) {
    return NextResponse.json({ error: workingDaysError.message }, { status: 500 });
  }

  const { data: overlapRows, error: overlapError } = await supabase.rpc(
    'check_vacation_overlap',
    {
      p_project_id: projectId,
      p_start: startDate,
      p_end: endDate,
      p_exclude_request_id: excludeRequestId,
    }
  );

  if (overlapError) {
    return NextResponse.json({ error: overlapError.message }, { status: 500 });
  }

  const overlap = overlapRows?.[0];
  const totalMembers = overlap?.total_members ?? 0;
  const overlappingMembers = overlap?.overlapping_members ?? 0;
  const thresholdPercent = overlap?.threshold_percent ?? 50;
  const overlapPercent =
    totalMembers > 0 ? Math.round((overlappingMembers / totalMembers) * 100) : 0;

  let annualGrants: Awaited<ReturnType<typeof fetchAnnualGrantSplitHints>> | null = null;
  if (leaveType === 'annual' && startDate) {
    annualGrants = await fetchAnnualGrantSplitHints(supabase, projectId, user.id, startDate);
  }

  return NextResponse.json({
    workingDays,
    overlap: {
      totalMembers,
      overlappingMembers,
      thresholdPercent,
      overlapPercent,
      exceedsThreshold: overlapPercent >= thresholdPercent,
    },
    annualGrants,
  });
}
