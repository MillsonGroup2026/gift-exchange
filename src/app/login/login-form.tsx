"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ initialError }: { initialError?: boolean }) {
  const [state, formAction, pending] = useActionState(
    requestMagicLink,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="rounded-xl border border-accent/30 bg-accent/5 p-5 text-center"
      >
        <p className="text-base font-semibold text-foreground">
          Check your inbox
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We sent a magic link to{" "}
          <span className="font-medium text-foreground">{state.email}</span>.
          Open it on this device to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {(state.status === "error" || initialError) && (
        <p
          role="alert"
          className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong"
        >
          {state.status === "error"
            ? state.message
            : "That sign-in link didn't work. Please request a new one."}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          defaultValue={state.email}
          placeholder="you@example.com"
          className="h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a magic link"}
      </button>
    </form>
  );
}
