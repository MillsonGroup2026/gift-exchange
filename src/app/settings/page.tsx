import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,email,default_anonymous")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">You</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{profile?.display_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{profile?.email ?? user.email}</dd>
            </div>
          </dl>
          <Link
            href="/account/password"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <KeyRound className="h-4 w-4" /> Change password
          </Link>
        </div>

        <SettingsForm initialAnonymous={profile?.default_anonymous ?? false} />
      </main>
    </div>
  );
}
