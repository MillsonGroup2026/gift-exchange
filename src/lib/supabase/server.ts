import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to the request cookies. Use in Server
 * Components, Server Actions, and Route Handlers. Runs as the signed-in user
 * (anon key + user JWT), so RLS applies — this is NOT a privileged client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // Force persistent cookies so the session survives tab eviction on
              // mobile (otherwise returning from an external link can log you out).
              cookieStore.set(name, value, {
                ...options,
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 365,
              }),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
