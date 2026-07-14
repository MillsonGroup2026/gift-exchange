"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2, Mail, Trash2 } from "lucide-react";
import {
  createShareLink,
  removeShare,
  revokeShareLink,
  shareWithEmail,
} from "@/app/lists/actions";
import type { ListShare } from "@/lib/types";

export function SharePanel({
  listId,
  initialToken,
  initialShares,
  shareOrigin,
}: {
  listId: string;
  initialToken: string | null;
  initialShares: ListShare[];
  shareOrigin: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [shares, setShares] = useState<ListShare[]>(initialShares);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const link = token ? `${shareOrigin}/share/${token}` : null;
  const invites = useMemo(() => shares.filter((s) => s.source === "invite"), [shares]);
  const linkViewers = useMemo(() => shares.filter((s) => s.source === "link").length, [shares]);

  function copy() {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyInvite() {
    if (!link) return;
    const msg =
      "I made a wishlist on Wishwell 🎁 — you can see what I'd love and quietly claim " +
      "what you want to give. I never see who claimed what, so the surprise stays safe. " +
      "Open the link, make a quick account (just email + password), and you'll see my list. " +
      "You can start your own list and share it back, too!\n\n" +
      link;
    navigator.clipboard?.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1800);
  }

  function makeLink() {
    setErr(null);
    start(async () => {
      const r = await createShareLink(listId);
      if (r?.error) setErr(r.error);
      else if (r?.token) setToken(r.token);
    });
  }

  function revoke() {
    setErr(null);
    start(async () => {
      const r = await revokeShareLink(listId);
      if (r?.error) setErr(r.error);
      else {
        setToken(null);
        setShares((s) => s.filter((x) => x.source !== "link"));
      }
    });
  }

  function addEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const clean = email.trim();
    if (!clean) return;
    start(async () => {
      const r = await shareWithEmail(listId, clean);
      if (r?.error) setErr(r.error);
      else if (r?.share) {
        setShares((s) => [...s, r.share as ListShare]);
        setEmail("");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await removeShare(id, listId);
      if (!r?.error) setShares((s) => s.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-card-foreground">Share</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anyone you share with can claim and comment — you&rsquo;ll never see what they do.
      </p>

      {err && (
        <p className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong">
          {err}
        </p>
      )}

      {/* Public link */}
      <div className="mt-4">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Link2 className="h-4 w-4" /> Public link
        </span>
        {link ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
              />
              <button
                type="button"
                onClick={copy}
                className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={copyInvite}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {copiedMsg ? "Invite message copied ✓" : "Copy an invite message"}
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={pending}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-brand-strong hover:underline disabled:opacity-50"
            >
              Revoke link {linkViewers > 0 ? `(${linkViewers} viewing)` : ""}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={makeLink}
            disabled={pending}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Create a shareable link
          </button>
        )}
      </div>

      {/* Invite by email */}
      <form onSubmit={addEmail} className="mt-5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Mail className="h-4 w-4" /> Invite by email
        </span>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mom@example.com"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Invite
          </button>
        </div>
      </form>

      {invites.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {invites.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm"
            >
              <span className="truncate text-foreground">{s.shared_with_email}</span>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="text-muted-foreground hover:text-brand-strong"
                aria-label={`Remove ${s.shared_with_email}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
