"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Gift, Loader2, Lock, MessageCircle, ShoppingBag, Trash2 } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { RichText } from "@/components/rich-text";
import { SubItemDisplay } from "@/components/sub-item-display";
import { ItemIcon } from "@/components/item-icon";
import { createClient } from "@/lib/supabase/client";
import {
  PRIORITY_LABELS,
  type Claim,
  type ClaimStatus,
  type Comment,
  type ListItem,
  type Priority,
  type WishList,
} from "@/lib/types";
import { addComment, claimTarget, deleteComment, releaseClaim, updateClaim } from "@/app/lists/actions";

function upsert<T extends { id: string }>(rows: T[], row: T) {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i === -1) return [...rows, row];
  const next = rows.slice();
  next[i] = row;
  return next;
}

const priorityStyle: Record<Priority, string> = {
  1: "bg-brand/12 text-brand-strong",
  2: "bg-accent/10 text-accent",
  3: "bg-muted text-muted-foreground",
};

type Person = { name: string; email: string };

export function GiverView({
  list,
  items,
  initialClaims,
  initialComments,
  names,
  emails,
  currentUserId,
  defaultAnonymous,
  ownerName,
}: {
  list: WishList;
  items: ListItem[];
  initialClaims: Claim[];
  initialComments: Comment[];
  names: Record<string, string>;
  emails: Record<string, string>;
  currentUserId: string;
  defaultAnonymous: boolean;
  ownerName: string;
}) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [comments, setComments] = useState<Comment[]>(initialComments);

  const who = (id: string): Person => ({
    name: id === currentUserId ? "You" : names[id] ?? "Someone",
    email: id === currentUserId ? "" : emails[id] ?? "",
  });

  useEffect(() => {
    const supabase = createClient();
    const itemIds = new Set(items.map((i) => i.id));
    const channel = supabase
      .channel(`list-${list.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, async (payload) => {
        const rec = (payload.new ?? payload.old) as { item_id?: string };
        if (!rec?.item_id || !itemIds.has(rec.item_id)) return;
        // Refetch through the redacting RPC so anonymous claimers stay hidden.
        const { data } = await supabase.rpc("list_claims", { p_list_id: list.id });
        if (data) setClaims(data as Claim[]);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `list_id=eq.${list.id}` },
        (payload) => {
          const rec = (payload.new ?? payload.old) as Comment;
          if (payload.eventType === "DELETE") setComments((p) => p.filter((c) => c.id !== rec.id));
          else setComments((p) => upsert(p, payload.new as Comment));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [list.id, items]);

  const claimsByItem = useMemo(() => {
    const m = new Map<string, Claim[]>();
    for (const c of claims) {
      const arr = m.get(c.item_id) ?? [];
      arr.push(c);
      m.set(c.item_id, arr);
    }
    return m;
  }, [claims]);

  const activeItems = items.filter((i) => !i.deleted_at);
  const removedItems = items.filter(
    (i) =>
      i.deleted_at &&
      ((claimsByItem.get(i.id)?.length ?? 0) > 0 || comments.some((c) => c.item_id === i.id)),
  );
  const listComments = comments.filter((c) => c.item_id === null);

  const renderItem = (item: ListItem, removed: boolean) => (
    <ItemBlock
      key={item.id}
      item={item}
      removed={removed}
      listId={list.id}
      claims={claimsByItem.get(item.id) ?? []}
      comments={comments.filter((c) => c.item_id === item.id)}
      currentUserId={currentUserId}
      defaultAnonymous={defaultAnonymous}
      who={who}
      allClaims={claims}
      onClaimChange={setClaims}
      onCommentAdd={(c) => setComments((p) => upsert(p, c))}
      onCommentDelete={(id) => setComments((p) => p.filter((x) => x.id !== id))}
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <p className="text-sm text-muted-foreground">{ownerName}&rsquo;s wishlist</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{list.title}</h1>
        {list.occasion && <p className="mt-1 text-muted-foreground">for {list.occasion}</p>}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-foreground">
          <Lock className="mt-0.5 h-4 w-4 flex-none text-accent" />
          <p>
            <span className="font-medium">{ownerName} can&rsquo;t see any of this.</span> What you
            claim and say here is visible only to the other gift-givers.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {activeItems.map((item) => renderItem(item, false))}
          {activeItems.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
              This list doesn&rsquo;t have any items yet.
            </p>
          )}
        </div>

        {removedItems.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              No longer on the list
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ownerName} removed these, but they&rsquo;re kept here since they were claimed.
            </p>
            <div className="mt-3 space-y-4">{removedItems.map((item) => renderItem(item, true))}</div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <MessageCircle className="h-4 w-4" /> Group chat
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Coordinate with the other givers — the recipient never sees this.
          </p>
          <div className="mt-3">
            <CommentThread
              comments={listComments}
              listId={list.id}
              itemId={null}
              currentUserId={currentUserId}
              who={who}
              onAdd={(c) => setComments((p) => upsert(p, c))}
              onDelete={(id) => setComments((p) => p.filter((x) => x.id !== id))}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function PersonLabel({ person }: { person: Person }) {
  return (
    <span>
      <span className="font-medium text-foreground">{person.name}</span>
      {person.email && <span className="text-xs text-muted-foreground"> · {person.email}</span>}
    </span>
  );
}

function ClaimTarget({
  itemId,
  optionId,
  targetClaims,
  removed,
  listId,
  currentUserId,
  defaultAnonymous,
  who,
  allClaims,
  onClaimChange,
}: {
  itemId: string;
  optionId: string | null;
  targetClaims: Claim[];
  removed: boolean;
  listId: string;
  currentUserId: string;
  defaultAnonymous: boolean;
  who: (id: string) => Person;
  allClaims: Claim[];
  onClaimChange: (next: Claim[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ClaimStatus | null>(null);
  const myClaim = targetClaims.find((c) => c.claimer_id === currentUserId) ?? null;
  const otherClaim = targetClaims.find((c) => c.claimer_id !== currentUserId) ?? null;

  async function confirmClaim(anonymous: boolean) {
    if (!pendingStatus) return;
    const status = pendingStatus;
    setPendingStatus(null);
    setBusy(true);
    setErr(null);
    const r = await claimTarget(itemId, optionId, listId, status, anonymous);
    if (r?.error) setErr(r.error);
    else if (r?.claim) onClaimChange(upsert(allClaims, r.claim as Claim));
    setBusy(false);
  }
  async function toggleStatus() {
    if (!myClaim) return;
    setBusy(true);
    const next: ClaimStatus = myClaim.status === "planning" ? "purchased" : "planning";
    onClaimChange(upsert(allClaims, { ...myClaim, status: next }));
    await updateClaim(myClaim.id, listId, { status: next });
    setBusy(false);
  }
  async function release() {
    if (!myClaim) return;
    setBusy(true);
    onClaimChange(allClaims.filter((c) => c.id !== myClaim.id));
    await releaseClaim(myClaim.id, listId);
    setBusy(false);
  }

  const primary = "rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong";
  const secondary = "rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted";

  return (
    <div>
      {otherClaim && (
        <p className="mb-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <Gift className="h-3.5 w-3.5 flex-none text-accent" />
          {otherClaim.claimer_id ? (
            <PersonLabel person={who(otherClaim.claimer_id)} />
          ) : (
            <span className="font-medium text-foreground">Someone</span>
          )}
          <span>
            {otherClaim.status === "purchased" ? "· bought this" : "· planning to get this"}
            {!otherClaim.claimer_id ? " (anonymously)" : ""}
          </span>
        </p>
      )}

      {pendingStatus ? (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Show this to the other givers as…</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => confirmClaim(false)} className={defaultAnonymous ? secondary : primary}>
              Show my name
            </button>
            <button type="button" onClick={() => confirmClaim(true)} className={defaultAnonymous ? primary : secondary}>
              Stay anonymous
            </button>
            <button
              type="button"
              onClick={() => setPendingStatus(null)}
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {myClaim ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
                <Check className="h-4 w-4" /> You&rsquo;re getting this{myClaim.anonymous ? " (anonymously)" : ""}
              </span>
              {!removed && (
                <button type="button" onClick={toggleStatus} disabled={busy} className={secondary}>
                  <span className="inline-flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4" />
                    {myClaim.status === "purchased" ? "Purchased" : "Mark purchased"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={release}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Release
              </button>
            </>
          ) : otherClaim ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
              <Check className="h-4 w-4" /> Claimed
            </span>
          ) : removed ? (
            <span className="text-sm text-muted-foreground">No longer available to claim.</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPendingStatus("planning")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Claim it
              </button>
              <button type="button" onClick={() => setPendingStatus("purchased")} disabled={busy} className={secondary}>
                Already bought it
              </button>
            </>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-brand-strong">{err}</p>}
    </div>
  );
}

function ItemBlock({
  item,
  removed,
  listId,
  claims,
  comments,
  currentUserId,
  defaultAnonymous,
  who,
  onClaimChange,
  allClaims,
  onCommentAdd,
  onCommentDelete,
}: {
  item: ListItem;
  removed: boolean;
  listId: string;
  claims: Claim[];
  comments: Comment[];
  currentUserId: string;
  defaultAnonymous: boolean;
  who: (id: string) => Person;
  onClaimChange: (next: Claim[]) => void;
  allClaims: Claim[];
  onCommentAdd: (c: Comment) => void;
  onCommentDelete: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const claimsFor = (optionId: string | null) => claims.filter((c) => c.option_id === optionId);
  const hasOptions = (item.options?.length ?? 0) > 0;

  const claimTargetProps = {
    itemId: item.id,
    removed,
    listId,
    currentUserId,
    defaultAnonymous,
    who,
    allClaims,
    onClaimChange,
  };

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${removed ? "opacity-70" : ""}`}>
      <div className="flex gap-3">
        <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-muted text-muted-foreground">
          <ItemIcon title={item.title} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-semibold text-card-foreground ${removed ? "line-through" : ""}`}>{item.title}</h3>
            {removed ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Removed</span>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle[item.priority]}`}>
                {PRIORITY_LABELS[item.priority]}
              </span>
            )}
          </div>
          {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
        </div>
      </div>

      {hasOptions ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Claim an option</p>
          {item.options.map((o) => (
            <div key={o.id} className="space-y-2">
              <SubItemDisplay option={o} />
              <div className="pl-1">
                <ClaimTarget {...claimTargetProps} optionId={o.id} targetClaims={claimsFor(o.id)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <ClaimTarget {...claimTargetProps} optionId={null} targetClaims={claimsFor(null)} />
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {comments.length > 0 ? comments.length : ""} {comments.length === 1 ? "note" : "notes"}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 border-t border-border pt-4">
          <CommentThread
            comments={comments}
            listId={listId}
            itemId={item.id}
            currentUserId={currentUserId}
            who={who}
            onAdd={onCommentAdd}
            onDelete={onCommentDelete}
          />
        </div>
      )}
    </div>
  );
}

function CommentThread({
  comments,
  listId,
  itemId,
  currentUserId,
  who,
  onAdd,
  onDelete,
}: {
  comments: Comment[];
  listId: string;
  itemId: string | null;
  currentUserId: string;
  who: (id: string) => Person;
  onAdd: (c: Comment) => void;
  onDelete: (id: string) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = body.trim();
    if (!clean) return;
    setBusy(true);
    setBody("");
    const r = await addComment(listId, itemId, clean);
    if (r?.comment) onAdd(r.comment as Comment);
    setBusy(false);
  }

  return (
    <div>
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-x-2">
                  <PersonLabel person={who(c.author_id)} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  {c.author_id === currentUserId && (
                    <button
                      type="button"
                      onClick={async () => {
                        onDelete(c.id);
                        await deleteComment(c.id, listId);
                      }}
                      className="text-muted-foreground hover:text-brand-strong"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{c.body}</p>
              </li>
            ))}
        </ul>
      )}
      <form onSubmit={submit} className={`flex items-center gap-2 ${comments.length > 0 ? "mt-3" : ""}`}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
