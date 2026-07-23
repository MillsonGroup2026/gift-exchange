import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Claim, Comment, ListItem, ListShare, WishList } from "@/lib/types";
import { OwnerEditor } from "./owner-editor";
import { GiverView } from "./giver-view";

export const dynamic = "force-dynamic";

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const { data: list } = await supabase.from("lists").select("*").eq("id", id).maybeSingle();
  if (!list) notFound();

  const { data: items } = await supabase
    .from("list_items")
    .select("*, options:list_item_options(*)")
    .eq("list_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const isOwner = list.owner_id === user.id;

  if (isOwner) {
    const { data: shares } = await supabase
      .from("list_shares")
      .select("*")
      .eq("list_id", id)
      .order("created_at", { ascending: true });
    const { data: myGroups } = await supabase.from("groups").select("id,name").order("name");
    return (
      <OwnerEditor
        list={list as WishList}
        initialItems={(items ?? []) as ListItem[]}
        shares={(shares ?? []) as ListShare[]}
        myGroups={(myGroups ?? []) as { id: string; name: string }[]}
        shareOrigin={await siteOrigin()}
      />
    );
  }

  // Giver view — include soft-deleted items so claimers keep their context.
  const { data: allItems } = await supabase
    .from("list_items")
    .select("*, options:list_item_options(*)")
    .eq("list_id", id)
    .order("position", { ascending: true });
  const giverItems = (allItems ?? []) as ListItem[];
  // list_claims redacts the claimer on anonymous claims that aren't the caller's own.
  const { data: claims } = await supabase.rpc("list_claims", { p_list_id: id });
  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .eq("list_id", id)
    .order("created_at", { ascending: true });

  const peopleIds = [
    ...new Set([
      list.owner_id,
      ...((claims ?? []) as Claim[]).map((c) => c.claimer_id),
      ...((comments ?? []) as Comment[]).map((c) => c.author_id),
    ]),
  ].filter((x): x is string => !!x);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id,display_name,email")
    .in("id", peopleIds);
  const names: Record<string, string> = Object.fromEntries(
    (profs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]),
  );
  const emails: Record<string, string> = Object.fromEntries(
    (profs ?? []).map((p) => [p.id, p.email ?? ""]),
  );

  const { data: me } = await supabase
    .from("profiles")
    .select("default_anonymous")
    .eq("id", user.id)
    .single();

  return (
    <GiverView
      list={list as WishList}
      items={giverItems}
      initialClaims={(claims ?? []) as Claim[]}
      initialComments={(comments ?? []) as Comment[]}
      names={names}
      emails={emails}
      currentUserId={user.id}
      defaultAnonymous={me?.default_anonymous ?? false}
      ownerName={names[list.owner_id] ?? "Someone"}
    />
  );
}
