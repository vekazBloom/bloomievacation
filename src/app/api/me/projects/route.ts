import { NextResponse } from 'next/server';
import { listMyProjects } from '@/lib/read/projects';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const result = listMyProjects(supabase, user.id);
  return NextResponse.json(await result);
}
