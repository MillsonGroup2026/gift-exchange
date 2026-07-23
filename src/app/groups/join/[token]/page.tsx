import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Invalid() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center px-6 py-5">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">This join link isn&rsquo;t active</h1>
        <p className="mt-2 text-muted-foreground">Ask whoever sent it for a fresh one.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center self-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Go to dashboard
        </Link>
      </main>
    </div>
  );
}

export default async function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: groupId, error } = await supabase.rpc("join_group_via_token", { p_token: token });
    if (error || !groupId) return <Invalid />;
    redirect(`/groups/${groupId}`);
  }

  const { data } = await supabase.rpc("get_group_preview", { p_token: token });
  if (!data) return <Invalid />;
  const group = data as { name: string; owner_name: string | null; member_count: number };
  const loginHref = `/login?next=${encodeURIComponent(`/groups/join/${token}`)}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center px-6 py-5">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Users className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Join {group.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {group.owner_name ?? "Someone"} invited you · {group.member_count}{" "}
          {group.member_count === 1 ? "member" : "members"}
        </p>
        <Link
          href={loginHref}
          className="mt-6 inline-flex items-center justify-center self-center rounded-full bg-brand px-6 py-3 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
        >
          Sign in to join
        </Link>
      </main>
    </div>
  );
}
