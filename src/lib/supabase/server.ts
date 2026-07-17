import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates) => {
        try {
          for (const { name, value, options } of updates) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. Proxy refreshes the session;
          // Actions and Route Handlers can write through this same adapter.
        }
      },
    },
  });
}
