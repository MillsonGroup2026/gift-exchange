import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. SERVER ONLY. Use exclusively for trusted
 * admin operations after verifying the caller's authority (e.g. generating a
 * Secret Santa draw once we've confirmed the caller is the organizer). Never
 * import into a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
