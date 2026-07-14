"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState(authenticate, {} as AuthState);

  const tab = (m: "signin" | "signup", label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-5 flex rounded-lg bg-muted p-1">
        {tab("signin", "Sign in")}
        {tab("signup", "Create account")}
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next ?? ""} />

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong"
          >
            {state.error}
          </p>
        )}

        {mode === "signup" && (
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-foreground">Your name</span>
            <input
              name="name"
              required
              autoComplete="name"
              placeholder="e.g. Noah Conner"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-left">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-left">
          <span className="text-sm font-medium text-foreground">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
