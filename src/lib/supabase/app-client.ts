import type { SupabaseClient } from '@supabase/supabase-js';

export type AppSupabase = SupabaseClient<any, 'public', any>;

export function asAppClient<T extends SupabaseClient<any, 'public', any>>(client: T): AppSupabase {
  return client as AppSupabase;
}
