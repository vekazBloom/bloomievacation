import { NextRequest } from 'next/server';
import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { listPendingApprovals } from '@/lib/read/leave-requests';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const params = request.nextUrl.searchParams;
  const projectId = params.get('projectId') ?? undefined;
  const limit = params.get('limit') ? Number(params.get('limit')) : undefined;

  const result = await listPendingApprovals(supabase, user.id, { projectId, limit });
  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ requests: result.requests });
}
