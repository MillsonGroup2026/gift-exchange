"use client";

import { useState, useTransition } from "react";
import { setDefaultAnonymous } from "./actions";

export function SettingsForm({ initialAnonymous }: { initialAnonymous: boolean }) {
  const [anon, setAnon] = useState(initialAnonymous);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  function toggle() {
    const next = !anon;
    setAnon(next);
    setSaved(false);
    start(async () => {
      await setDefaultAnonymous(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-card-foreground">Claim gifts anonymously by default</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When on, gifts you claim are hidden from the other givers by default (they see
            &ldquo;Someone&rdquo;). You&rsquo;re always asked each time you claim, so you can override
            it either way. The list owner never sees claims regardless.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={anon}
          onClick={toggle}
          className={`relative mt-1 h-6 w-11 flex-none rounded-full transition-colors ${
            anon ? "bg-brand" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              anon ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {saved && <p className="mt-3 text-xs font-medium text-accent">Saved ✓</p>}
    </div>
  );
}
