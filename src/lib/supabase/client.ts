import { createBrowserClient } from '@supabase/ssr';
import { asAppClient, type AppSupabase } from '@/lib/supabase/app-client';
import type { Database } from '@/types/database.generated';

export function createClient(): AppSupabase {
  return asAppClient(
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
}
