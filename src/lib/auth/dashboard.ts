import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

type DashboardProject = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  role: 'admin' | 'lead' | 'employee';
};

type DashboardProfile = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_system_admin: boolean;
};

export const getAuthenticatedUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});

export const getDashboardSession = cache(async () => {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      name: (user.user_metadata?.name as string) || user.email!.split('@')[0],
    });
  }

  const { data: memberships } = await supabase
    .from('project_members')
    .select('role, projects(id, slug, name, logo_url, is_archived)')
    .eq('user_id', user.id);

  const projects =
    (memberships || [])
      .map((membership: { role: DashboardProject['role']; projects: unknown }) => {
        const project = Array.isArray(membership.projects) ? membership.projects[0] : membership.projects;
        if (!project || typeof project !== 'object') {
          return null;
        }

        const record = project as {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          is_archived: boolean;
        };

        if (record.is_archived) {
          return null;
        }

        return {
          id: record.id,
          slug: record.slug,
          name: record.name,
          logo_url: record.logo_url,
          role: membership.role,
        };
      })
      .filter((project): project is DashboardProject => Boolean(project)) || [];

  const profileData: DashboardProfile = profile || {
    id: user.id,
    email: user.email!,
    name: user.email!.split('@')[0],
    avatar_url: null,
    is_system_admin: false,
  };

  return {
    supabase,
    user,
    profile: profileData,
    projects,
  };
});
