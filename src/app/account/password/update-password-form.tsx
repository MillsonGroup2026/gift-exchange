"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/login/actions";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {} as AuthState);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-foreground">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          autoFocus
          placeholder="At least 6 characters"
          className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
