import { NextRequest, NextResponse } from 'next/server';
import { sendCarryOverWarnings } from '@/lib/carry-over/process';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const result = await sendCarryOverWarnings(service);
  return NextResponse.json(result);
}
