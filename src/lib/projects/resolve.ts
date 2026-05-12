import type { AppSupabase } from '@/lib/supabase/app-client';
import type { Database } from '@/types/database.generated';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export async function getProjectBySlug(supabase: AppSupabase, slug: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  return { project: data as ProjectRow | null, error };
}

export async function getProjectSlugById(supabase: AppSupabase, projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', projectId)
    .maybeSingle();

  return { slug: data?.slug ?? null, error };
}
