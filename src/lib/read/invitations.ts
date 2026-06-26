import { isProjectAdmin } from '@/lib/projects/membership';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function listMySentInvitations(supabase: AppSupabase, userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at, projects(name, slug)')
    .eq('invited_by', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    invitations: (data || []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: row.expires_at,
      projectName: (Array.isArray(row.projects) ? row.projects[0] : row.projects)?.name ?? 'Projekat',
    })),
  };
}

export async function listProjectPendingInvites(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  const canManage = await isProjectAdmin(supabase, userId, projectId);
  if (!canManage) {
    return { ok: false as const, error: 'Samo admin projekta može vidjeti pozivnice.', status: 403 };
  }

  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return { ok: true as const, invitations: data || [] };
}

export async function searchUsersForInvite(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  query: string
) {
  const canManage = await isProjectAdmin(supabase, userId, projectId);
  if (!canManage) {
    return { ok: false as const, error: 'Samo admin projekta može pretraživati korisnike.', status: 403 };
  }

  if (query.trim().length < 2) {
    return { ok: false as const, error: 'Upit mora imati najmanje 2 znaka.', status: 400 };
  }

  const { data: members } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);

  const memberIds = new Set((members || []).map((m) => m.user_id));

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    users: (data || [])
      .filter((u) => !memberIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}
