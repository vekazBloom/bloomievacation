import { NextRequest } from 'next/server';
import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { listAwayThisWeek } from '@/lib/read/leave-requests';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const limit = request.nextUrl.searchParams.get('limit')
    ? Number(request.nextUrl.searchParams.get('limit'))
    : undefined;

  const result = await listAwayThisWeek(supabase, user.id, { limit });
  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ entries: result.entries });
}
