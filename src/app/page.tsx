import Link from "next/link";
import { Wordmark } from "@/components/brand";

const features = [
  {
    title: "Nothing spoils the surprise",
    body: "Recipients can never see who claimed what — not in the app, not in a notification, not anywhere. Privacy is enforced in the database, not just hidden in the screen.",
  },
  {
    title: "Easy as a notes app",
    body: "Add an item with a title, a link, a note, and how much you'd love it. Drag to reorder. Edit anytime, even after you've shared.",
  },
  {
    title: "Givers coordinate quietly",
    body: "Family and friends claim items, mark them planning or purchased, and chat behind the scenes — so nobody double-buys.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <section className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Keeps the surprise, every time
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Wishlists your people can actually shop from.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
            Jot down what you&rsquo;d love. Share it with family and friends.
            They quietly claim and coordinate gifts behind the scenes &mdash; and
            you never see a thing until you unwrap it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Start a wishlist
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              I was sent a list
            </Link>
          </div>
        </section>

        <section className="grid w-full gap-4 pb-24 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 text-left"
            >
              <h2 className="text-base font-semibold text-card-foreground">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-muted-foreground">
          Wishing Well &middot; made for generous people
        </div>
      </footer>
    </div>
  );
}
