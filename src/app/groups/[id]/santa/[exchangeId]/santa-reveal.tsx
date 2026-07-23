"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Gift } from "lucide-react";

export type Recipient = { name: string; email: string; lists: { id: string; title: string }[] };
export type Assignment = { giver: string; recipient: string };

export function SantaReveal({
  recipients,
  isOrganizer,
  allAssignments,
}: {
  recipients: Recipient[];
  isOrganizer: boolean;
  allAssignments: Assignment[] | null;
}) {
  const [show, setShow] = useState(false);
  const [revealAll, setRevealAll] = useState(false);

  return (
    <div className="space-y-4">
      {recipients.length > 0 ? (
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-8 text-center">
          <Gift className="mx-auto h-8 w-8 text-brand" />
          <p className="mt-2 text-sm text-muted-foreground">
            {recipients.length > 1 ? "You're giving gifts to…" : "You're giving a gift to…"}
          </p>
          {show ? (
            <div className="mt-3 space-y-6">
              {recipients.length > 1 && (
                <p className="text-sm font-medium text-gold">
                  🎁 You drew {recipients.length} people this year — so everyone gets a gift!
                </p>
              )}
              {recipients.map((r, i) => (
                <div key={i}>
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{r.name}</p>
                  {r.email && <p className="mt-0.5 text-sm text-muted-foreground">{r.email}</p>}
                  {r.lists.length > 0 ? (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {r.lists.map((l) => (
                        <Link
                          key={l.id}
                          href={`/lists/${l.id}`}
                          className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
                        >
                          Open their &ldquo;{l.title}&rdquo;
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      They haven&rsquo;t shared a wishlist with this group yet.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShow(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
            >
              <Eye className="h-4 w-4" /> Tap to reveal
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          Names have been drawn, but you&rsquo;re not a participant in this one.
        </div>
      )}

      {isOrganizer && allAssignments && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <button
            type="button"
            onClick={() => setRevealAll((r) => !r)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {revealAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {revealAll ? "Hide everyone's assignments" : "Unhide all — organizer check"}
          </button>
          {revealAll && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {allAssignments.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{a.giver}</span>
                  <span className="text-muted-foreground">→ {a.recipient}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
