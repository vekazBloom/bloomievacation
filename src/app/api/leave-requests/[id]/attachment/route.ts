import { NextResponse } from 'next/server';
import { canReviewLeave, getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: requestRow } = await supabase
    .from('leave_requests')
    .select('id, user_id, project_id, attachment_url')
    .eq('id', params.id)
    .maybeSingle();

  if (!requestRow?.attachment_url) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const isOwner = requestRow.user_id === user.id;
  const canReview = await canReviewLeave(requestRow.project_id, user.id);
  if (!isOwner && !canReview) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from('sick-leave-attachments')
    .createSignedUrl(requestRow.attachment_url, 60 * 10);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Failed to sign attachment URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
