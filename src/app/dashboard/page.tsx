import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Plus, Users } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { createList } from "@/app/lists/actions";
import { OCCASIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
  const shared = status === "shared";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        shared ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
      }`}
    >
      {shared ? "Shared" : "Draft"}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "friend";

  const { data: ownLists } = await supabase
    .from("lists")
    .select("id,title,occasion,status,updated_at,list_items(count)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const { data: sharedLists } = await supabase
    .from("lists")
    .select("id,title,occasion,owner_id,updated_at")
    .neq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  let ownerNames: Record<string, string> = {};
  if (sharedLists?.length) {
    const ids = [...new Set(sharedLists.map((l) => l.owner_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", ids);
    ownerNames = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Hi {name} 👋
        </h1>
        <p className="mt-2 text-muted-foreground">
          Make a wishlist, or open one someone shared with you.
        </p>

        {/* New list */}
        <form
          action={createList}
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">New wishlist</span>
            <input
              name="title"
              required
              placeholder="e.g. My birthday list"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:w-52">
            <span className="text-sm font-medium text-foreground">Occasion</span>
            <input
              name="occasion"
              list="occasions"
              placeholder="Optional"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <datalist id="occasions">
              {OCCASIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </form>

        {/* Your lists */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <Gift className="h-4 w-4" /> Your lists
          </h2>
          {ownLists?.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ownLists.map((l) => {
                const count = (l.list_items as { count: number }[] | null)?.[0]?.count ?? 0;
                return (
                  <Link
                    key={l.id}
                    href={`/lists/${l.id}`}
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-card-foreground group-hover:text-brand-strong">
                        {l.title}
                      </h3>
                      <StatusPill status={l.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {l.occasion ? `${l.occasion} · ` : ""}
                      {count} {count === 1 ? "item" : "items"}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="text-foreground">No lists yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first wishlist above — it takes a few seconds.
              </p>
            </div>
          )}
        </section>

        {/* Shared with you */}
        {sharedLists && sharedLists.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <Users className="h-4 w-4" /> Shared with you
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sharedLists.map((l) => (
                <Link
                  key={l.id}
                  href={`/lists/${l.id}`}
                  className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/40"
                >
                  <h3 className="font-semibold text-card-foreground group-hover:text-accent">
                    {l.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {ownerNames[l.owner_id] ?? "Someone"}
                    {l.occasion ? ` · ${l.occasion}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
