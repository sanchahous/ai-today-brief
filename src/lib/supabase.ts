import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient<Database> | null | undefined;

/**
 * Anon Supabase client for public, RLS-gated reads (server components + browser).
 *
 * Returns `null` when the env is absent — e.g. a local build without `.env.local`
 * — so callers fall back gracefully instead of the build crashing. Writes never
 * go through here: they run server-side via Edge Functions with the service role.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (cached !== undefined) return cached;
  cached =
    url && anonKey
      ? createClient<Database>(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return cached;
}
