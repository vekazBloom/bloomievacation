import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { asAppClient, type AppSupabase } from '@/lib/supabase/app-client';
import type { Database } from '@/types/database.generated';

export function createClient(): AppSupabase {
  const cookieStore = cookies();

  return asAppClient(createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components can't set cookies; this is handled by middleware.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  ));
}

/**
 * Service-role client. Use only in server-only code (Route Handlers, Server Actions)
 * for operations that must bypass RLS — e.g. accepting invitations, sending mail
 * on behalf of another user, system tasks.
 */
export function createServiceClient(): AppSupabase {
  return asAppClient(createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() {
          return undefined;
        },
        set() {},
        remove() {},
      },
    }
  ));
}
