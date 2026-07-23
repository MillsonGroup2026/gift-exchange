import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { createGroup } from "./actions";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve any pending email invites into active memberships on load.
  await supabase.rpc("claim_group_invites");

  const { data: groups } = await supabase
    .from("groups")
    .select("id,name,owner_id,group_members(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Groups</h1>
        <p className="mt-2 text-muted-foreground">
          Gather your people — a family, a friend group. Share a list with a group in one go, and run
          a Secret Santa.
        </p>

        <form
          action={createGroup}
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">New group</span>
            <input
              name="name"
              required
              placeholder="e.g. Conner Family"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </form>

        {groups?.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const count = (g.group_members as { count: number }[] | null)?.[0]?.count ?? 0;
              return (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </span>
                    <h3 className="font-semibold text-card-foreground group-hover:text-brand-strong">
                      {g.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {count} {count === 1 ? "member" : "members"}
                    {g.owner_id === user.id ? " · you own this" : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-foreground">No groups yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one above, or open a join link someone sent you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
