"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };

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
