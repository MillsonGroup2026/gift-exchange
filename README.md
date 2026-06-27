# Wishwell

Gift wishlists that keep the surprise. People make and share wishlists; their
gift-givers privately claim and discuss items **without the list owner ever
finding out**.

> Privacy is the product. The owner-exclusion rule — an owner can never learn
> what was claimed on their own list, through any path — is enforced in Postgres
> Row Level Security, not in the UI.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth (magic link), Row Level Security, Realtime
- **Anthropic** Messages API (server-only) — Phase 6
- Hosted on **Render**, repo on GitHub (`MillsonGroup2026`)

## Local setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in your Supabase values
   (Supabase dashboard → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only**, bypasses RLS, never sent to the browser
   - `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000` for local dev
3. Apply the database migration in `supabase/migrations/0001_init.sql`:
   - Easiest: paste it into the Supabase **SQL Editor** and run it, **or**
   - CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`
4. In Supabase **Authentication → URL Configuration**, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/confirm`
   - (add the Render URLs too, once deployed)
5. `npm run dev` → http://localhost:3000

## Auth flow

Passwordless magic-link sign-in. The login form calls a server action
(`signInWithOtp`) that emails a link. The default email lands on
`/auth/callback` (PKCE code exchange, same device). For cross-device links,
point the Supabase email template at
`/auth/confirm?token_hash={{ .TokenHash }}&type=email` — handled by
`src/app/auth/confirm/route.ts`. A Postgres trigger (`handle_new_user`) creates
a `profiles` row automatically on first sign-in.

## Build & deploy

- **Always run `npm run build` locally before pushing.** Render keeps the last
  successful build live when a new build fails, so a type/lint error silently
  ships nothing.
- Deploy: Render web service (see `render.yaml`), auto-deploys from `main`. Set
  env vars in the Render dashboard. `NEXT_PUBLIC_*` vars are baked in at **build
  time** — trigger a fresh deploy after changing them.

## Build phases

1. **Foundation** — magic-link auth, profiles on sign-in, deploy _(current)_
2. Lists & items
3. Privacy layer (RLS excluding the owner + regression test)
4. Sharing + giver view (atomic claiming, comments, realtime)
5. Groups (invite by email, identity linking, overlapping membership)
6. AI summary (server-side Anthropic, structured JSON)
7. Polish (visual identity, empty states, mobile, a11y)
