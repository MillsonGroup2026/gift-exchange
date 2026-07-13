"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Only allow same-site relative redirects (not "//evil.com").
function safeNext(raw: unknown): string | null {
  const v = String(raw ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

/**
 * Sends a magic-link sign-in email. Used with useActionState on the login page.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const next = safeNext(formData.get("next"));
  if (next) {
    // Read back after the emailed link lands (the email template's next is fixed).
    (await cookies()).set("sb_next", next, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30,
    });
  }

  const supabase = await createClient();
  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message, email };
  }

  return { status: "sent", email };
}
