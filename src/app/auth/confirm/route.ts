import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicOrigin } from "@/lib/site-url";

/**
 * token_hash verification callback. More robust than the PKCE code flow for
 * cross-device magic links (e.g. requested on desktop, opened on a phone).
 * Requires the Supabase email template to point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getPublicOrigin(request);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const store = await cookies();
  const cookieNext = store.get("sb_next")?.value;
  const next =
    (cookieNext && cookieNext.startsWith("/") ? cookieNext : null) ??
    searchParams.get("next") ??
    "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      if (cookieNext) res.cookies.set("sb_next", "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
