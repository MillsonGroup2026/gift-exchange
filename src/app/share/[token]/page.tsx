import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Lock } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { RichText } from "@/components/rich-text";
import { LinkCard } from "@/components/link-card";
import { ItemIcon } from "@/components/item-icon";
import { createClient } from "@/lib/supabase/server";
import {
  PRIORITY_LABELS,
  type LinkMeta,
  type Priority,
  type RichText as RichTextT,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const priorityStyle: Record<Priority, string> = {
  1: "bg-brand/12 text-brand-strong",
  2: "bg-accent/10 text-accent",
  3: "bg-muted text-muted-foreground",
};

type PreviewOption = { id: string; name: string | null; url: string | null; link_meta: LinkMeta | null };
type PreviewItem = {
  id: string;
  title: string;
  description: RichTextT;
  priority: Priority;
  options: PreviewOption[];
};

function InvalidLink() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center px-6 py-5">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">This link isn&rsquo;t active</h1>
        <p className="mt-2 text-muted-foreground">
          It may have been revoked, or the list isn&rsquo;t shared anymore. Ask whoever sent it for a
          fresh link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center self-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back home
        </Link>
      </main>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: listId, error } = await supabase.rpc("redeem_share_token", { p_token: token });
    if (error || !listId) return <InvalidLink />;
    redirect(`/lists/${listId}`);
  }

  const { data } = await supabase.rpc("get_shared_list", { p_token: token });
  if (!data) return <InvalidLink />;

  const list = (data as { list: { title: string; occasion: string | null; owner_name: string | null } }).list;
  const items = ((data as { items: PreviewItem[] }).items ?? []) as PreviewItem[];
  const loginHref = `/login?next=${encodeURIComponent(`/share/${token}`)}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Wordmark />
          <Link
            href={loginHref}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            Sign in to claim
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <p className="text-sm text-muted-foreground">{list.owner_name ?? "Someone"}&rsquo;s wishlist</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{list.title}</h1>
        {list.occasion && <p className="mt-1 text-muted-foreground">for {list.occasion}</p>}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 flex-none text-brand-strong" />
          <p className="text-foreground">
            <Link href={loginHref} className="font-semibold text-brand-strong underline underline-offset-2">
              Sign in
            </Link>{" "}
            to claim items and chat with the other givers — {list.owner_name ?? "the owner"} will never
            see it.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-muted text-muted-foreground">
                  <ItemIcon title={item.title} className="h-4 w-4" />
                </span>
                <h3 className="font-semibold text-card-foreground">{item.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle[item.priority]}`}>
                  {PRIORITY_LABELS[item.priority]}
                </span>
              </div>
              {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
              {item.options?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {item.options.map((o) =>
                    o.url ? (
                      <LinkCard key={o.id} url={o.url} meta={o.link_meta} label={o.name} />
                    ) : (
                      <div
                        key={o.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm"
                      >
                        <ItemIcon title={o.name ?? ""} className="h-4 w-4 flex-none text-muted-foreground" />
                        <span className="font-medium text-foreground">{o.name}</span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
              This list doesn&rsquo;t have any items yet.
            </p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center">
          <Link
            href={loginHref}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            <Gift className="h-4 w-4" /> Sign in to claim a gift
          </Link>
        </div>
      </main>
    </div>
  );
}
