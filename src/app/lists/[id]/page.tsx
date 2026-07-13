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
    .select("*")
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
    return (
      <OwnerEditor
        list={list as WishList}
        initialItems={(items ?? []) as ListItem[]}
        shares={(shares ?? []) as ListShare[]}
        shareOrigin={await siteOrigin()}
      />
    );
  }

  // Giver view
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: claims } = itemIds.length
    ? await supabase.from("claims").select("*").in("item_id", itemIds)
    : { data: [] as Claim[] };
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
  ];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", peopleIds);
  const names: Record<string, string> = Object.fromEntries(
    (profs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]),
  );

  return (
    <GiverView
      list={list as WishList}
      items={(items ?? []) as ListItem[]}
      initialClaims={(claims ?? []) as Claim[]}
      initialComments={(comments ?? []) as Comment[]}
      names={names}
      currentUserId={user.id}
      ownerName={names[list.owner_id] ?? "Someone"}
    />
  );
}
