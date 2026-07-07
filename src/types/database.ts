import type { Database as SupabaseDatabase } from './database.generated';

export type Database = SupabaseDatabase;
export type { Json } from './database.generated';

export type ProjectRole = SupabaseDatabase['public']['Enums']['project_role'];
export type LeaveType = SupabaseDatabase['public']['Enums']['leave_type'];
export type LeaveStatus = SupabaseDatabase['public']['Enums']['leave_status'];
export type CarryOverPolicy = SupabaseDatabase['public']['Enums']['carry_over_policy'];
export type ReligionCategory = SupabaseDatabase['public']['Enums']['religion_category'];
export type NotificationType = SupabaseDatabase['public']['Enums']['notification_type'];
export type RoadmapItemStatus = SupabaseDatabase['public']['Enums']['roadmap_item_status'];
export type RoadmapTeamKind = SupabaseDatabase['public']['Enums']['roadmap_team_kind'];
