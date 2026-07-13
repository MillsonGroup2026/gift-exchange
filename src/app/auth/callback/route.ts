import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicOrigin } from "@/lib/site-url";

/**
 * PKCE code-exchange callback. The default Supabase magic-link email redirects
 * here with a `code` after the user clicks it (same device/browser).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
