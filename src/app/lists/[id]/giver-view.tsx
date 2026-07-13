"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Gift, Loader2, Lock, MessageCircle, ShoppingBag, Trash2 } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { RichText } from "@/components/rich-text";
import { LinkCard } from "@/components/link-card";
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
import { addComment, claimItem, deleteComment, releaseClaim, updateClaim } from "@/app/lists/actions";

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

export function GiverView({
  list,
  items,
  initialClaims,
  initialComments,
  names,
  currentUserId,
  ownerName,
}: {
  list: WishList;
  items: ListItem[];
  initialClaims: Claim[];
  initialComments: Comment[];
  names: Record<string, string>;
  currentUserId: string;
  ownerName: string;
}) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [comments, setComments] = useState<Comment[]>(initialComments);

  const nameOf = (id: string) =>
    id === currentUserId ? "You" : names[id] ?? "Someone";

  // Realtime: keep claims/comments live so givers don't double-buy.
  useEffect(() => {
    const supabase = createClient();
    const itemIds = new Set(items.map((i) => i.id));
    const channel = supabase
      .channel(`list-${list.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, (payload) => {
        const rec = (payload.new ?? payload.old) as Claim;
        if (!rec || !itemIds.has(rec.item_id)) return;
        if (payload.eventType === "DELETE") setClaims((p) => p.filter((c) => c.id !== rec.id));
        else setClaims((p) => upsert(p, payload.new as Claim));
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

  const listComments = comments.filter((c) => c.item_id === null);

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
            claim and say here stays between the gift-givers.
          </p>
        </div>

        {/* Items */}
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <ItemBlock
              key={item.id}
              item={item}
              listId={list.id}
              claims={claimsByItem.get(item.id) ?? []}
              comments={comments.filter((c) => c.item_id === item.id)}
              currentUserId={currentUserId}
              nameOf={nameOf}
              onClaimChange={(next) => setClaims(next)}
              allClaims={claims}
              onCommentAdd={(c) => setComments((p) => upsert(p, c))}
              onCommentDelete={(id) => setComments((p) => p.filter((x) => x.id !== id))}
            />
          ))}
          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
              This list doesn&rsquo;t have any items yet.
            </p>
          )}
        </div>

        {/* List-level discussion */}
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
              nameOf={nameOf}
              onAdd={(c) => setComments((p) => upsert(p, c))}
              onDelete={(id) => setComments((p) => p.filter((x) => x.id !== id))}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function ItemBlock({
  item,
  listId,
  claims,
  comments,
  currentUserId,
  nameOf,
  onClaimChange,
  allClaims,
  onCommentAdd,
  onCommentDelete,
}: {
  item: ListItem;
  listId: string;
  claims: Claim[];
  comments: Comment[];
  currentUserId: string;
  nameOf: (id: string) => string;
  onClaimChange: (next: Claim[]) => void;
  allClaims: Claim[];
  onCommentAdd: (c: Comment) => void;
  onCommentDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [showComments, setShowComments] = useState(false);

  const totalClaimed = claims.reduce((n, c) => n + c.quantity, 0);
  const remaining = Math.max(0, item.quantity - totalClaimed);
  const myClaim = claims.find((c) => c.claimer_id === currentUserId) ?? null;
  const others = claims.filter((c) => c.claimer_id !== currentUserId);

  async function doClaim(status: ClaimStatus) {
    setBusy(true);
    setErr(null);
    const r = await claimItem(item.id, listId, item.quantity > 1 ? qty : 1, status);
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-card-foreground">{item.title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyle[item.priority]}`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
        {item.quantity > 1 && (
          <span className="text-xs text-muted-foreground">
            {totalClaimed}/{item.quantity} claimed
          </span>
        )}
      </div>
      {item.description?.html && <RichText html={item.description.html} className="mt-2" />}
      {item.url && <LinkCard url={item.url} meta={item.link_meta} />}

      {/* Who's getting it */}
      {others.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {others.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-muted-foreground">
              <Gift className="h-3.5 w-3.5 text-accent" />
              <span className="font-medium text-foreground">{nameOf(c.claimer_id)}</span>
              {c.quantity > 1 ? ` (${c.quantity}) ` : " "}
              is {c.status === "purchased" ? "buying this" : "planning to get this"}
            </li>
          ))}
        </ul>
      )}

      {/* Claim controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {myClaim ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
              <Check className="h-4 w-4" /> You&rsquo;re getting this
            </span>
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {myClaim.status === "purchased" ? "Purchased" : "Mark purchased"}
            </button>
            <button
              type="button"
              onClick={release}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Release
            </button>
          </>
        ) : remaining > 0 ? (
          <>
            {item.quantity > 1 && (
              <input
                type="number"
                min={1}
                max={remaining}
                value={qty}
                onChange={(e) => setQty(Math.min(remaining, Math.max(1, Number(e.target.value) || 1)))}
                className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
              />
            )}
            <button
              type="button"
              onClick={() => doClaim("planning")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Claim it
            </button>
            <button
              type="button"
              onClick={() => doClaim("purchased")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Already bought it
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <Check className="h-4 w-4" /> Fully claimed
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {comments.length > 0 ? comments.length : ""} {comments.length === 1 ? "note" : "notes"}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-brand-strong">{err}</p>}

      {showComments && (
        <div className="mt-4 border-t border-border pt-4">
          <CommentThread
            comments={comments}
            listId={listId}
            itemId={item.id}
            currentUserId={currentUserId}
            nameOf={nameOf}
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
  nameOf,
  onAdd,
  onDelete,
}: {
  comments: Comment[];
  listId: string;
  itemId: string | null;
  currentUserId: string;
  nameOf: (id: string) => string;
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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{nameOf(c.author_id)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
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
