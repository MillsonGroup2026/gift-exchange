"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };
export type ResetState = { error?: string; sent?: boolean };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function safeNext(raw: unknown): string {
  const v = String(raw ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email or password isn't right.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account — switch to Sign in.";
  if (m.includes("at least") || m.includes("password")) return "Password must be at least 6 characters.";
  return msg || "Something went wrong. Please try again.";
}

/**
 * Single entry point for both sign in and sign up (chosen by the `mode` field).
 * Email confirmations are disabled on the project, so sign-up returns a session
 * immediately — no email round-trip, no rate limits.
 */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = String(formData.get("mode") ?? "signin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const supabase = await createClient();

  if (mode === "signup") {
    const name = String(formData.get("name") ?? "").trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name || email.split("@")[0] } },
    });
    if (error) return { error: friendly(error.message) };
    if (!data.session) {
      // Only happens if email confirmation is re-enabled on the project.
      return { error: "Account created — please sign in." };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendly(error.message) };
  }

  redirect(next);
}

/** Send a password-reset email. Always reports success (no account enumeration). */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/account/password`,
  });
  return { sent: true };
}

/** Set a new password for the signed-in (or recovery-authenticated) user. */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link expired — request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
