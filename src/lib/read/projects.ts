import { getUserProjectRoles } from '@/lib/projects/membership';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function listMyProjects(supabase: AppSupabase, userId: string) {
  const projects = await getUserProjectRoles(supabase, userId);
  return { projects };
}
