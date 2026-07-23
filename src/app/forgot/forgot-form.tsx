"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetState } from "@/app/login/actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as ResetState);

  if (state.sent) {
    return (
      <div
        role="status"
        className="rounded-xl border border-accent/30 bg-accent/5 p-5 text-center"
      >
        <p className="text-base font-semibold text-foreground">Check your inbox</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          If an account exists for that email, a reset link is on its way. Open it to set a new
          password. (It can take a minute — check spam too.)
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
