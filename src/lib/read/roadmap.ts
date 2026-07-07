import type { AppSupabase } from '@/lib/supabase/app-client';
import type { Database } from '@/types/database.generated';
import { computeRoadmapMonths, type RoadmapMonth } from '@/lib/roadmap/months';

export type RoadmapTeam = Database['public']['Tables']['roadmap_teams']['Row'];
export type RoadmapTeamMember = Database['public']['Tables']['roadmap_team_members']['Row'];
export type RoadmapItem = Database['public']['Tables']['roadmap_items']['Row'];

export type RoadmapTeamWithMembers = RoadmapTeam & { members: RoadmapTeamMember[] };

export type RoadmapData = {
  teams: RoadmapTeamWithMembers[];
  items: RoadmapItem[];
  months: RoadmapMonth[];
};

export async function getRoadmap(supabase: AppSupabase): Promise<RoadmapData> {
  const [teamsRes, membersRes, itemsRes] = await Promise.all([
    supabase.from('roadmap_teams').select('*').order('sort_order', { ascending: true }),
    supabase.from('roadmap_team_members').select('*').order('sort_order', { ascending: true }),
    supabase
      .from('roadmap_items')
      .select('*')
      .order('start_month', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true }),
  ]);

  const teams = (teamsRes.data ?? []) as RoadmapTeam[];
  const members = (membersRes.data ?? []) as RoadmapTeamMember[];
  const items = (itemsRes.data ?? []) as RoadmapItem[];

  const teamsWithMembers: RoadmapTeamWithMembers[] = teams.map((team) => ({
    ...team,
    members: members.filter((m) => m.team_id === team.id),
  }));

  return {
    teams: teamsWithMembers,
    items,
    months: computeRoadmapMonths(items),
  };
}
