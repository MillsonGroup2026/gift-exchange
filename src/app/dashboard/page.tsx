import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, created_at")
    .eq("id", user.id)
    .single();

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "friend";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Welcome, {name}.
        </h1>
        <p className="mt-2 text-muted-foreground">
          You&rsquo;re signed in. This is your home base for the lists you make
          and the ones shared with you.
        </p>

        <section className="mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Your profile
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">
                {profile?.display_name ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">
                {profile?.email ?? user.email}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium text-foreground">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 max-w-md rounded-2xl border border-dashed border-border bg-card/50 p-6">
          <h2 className="text-base font-semibold text-foreground">
            Your lists
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wishlists arrive in Phase 2. Soon you&rsquo;ll create one here in
            seconds.
          </p>
        </section>
      </main>
    </div>
  );
}
