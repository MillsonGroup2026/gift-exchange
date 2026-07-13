-- ============================================================================
-- 0002_lists_items.sql — Phase 2: wishlists and their items (owner side)
-- ============================================================================

create table if not exists public.lists (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users (id) on delete cascade,
  title                  text not null,
  occasion               text,
  status                 text not null default 'draft' check (status in ('draft', 'shared')),
  public_share_token     text unique,
  ai_summary             jsonb,
  ai_summary_updated_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists lists_owner_idx on public.lists (owner_id);
create index if not exists lists_token_idx on public.lists (public_share_token);

create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  title        text not null,
  description  jsonb,        -- rich text: { "html": "...", "text": "..." }
  url          text,
  link_meta    jsonb,        -- { title, description, image, favicon, siteName }
  priority     smallint not null default 2 check (priority between 1 and 3), -- 1=love, 2=like, 3=nice extra
  quantity     integer not null default 1 check (quantity >= 1),
  position     double precision not null default 0,
  deleted_at   timestamptz,  -- soft delete (keeps giver claim context)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists list_items_list_idx on public.list_items (list_id);
create index if not exists list_items_pos_idx on public.list_items (list_id, position);

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();
create trigger list_items_set_updated_at
  before update on public.list_items
  for each row execute function public.set_updated_at();

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- Owner has full control of their own lists. Viewer (giver) read policies are
-- added in 0003 once the sharing model exists.
drop policy if exists lists_owner_all on public.lists;
create policy lists_owner_all on public.lists
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists list_items_owner_all on public.list_items;
create policy list_items_owner_all on public.list_items
  for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()));
