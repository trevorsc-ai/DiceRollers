import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client for admin-only API routes (bypasses RLS).
 * Service-role clients hold no per-request state, so we cache one for the
 * lifetime of the worker. Lazy so module load doesn't crash builds that
 * haven't injected env vars yet.
 */
export function getAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return cached;
}
