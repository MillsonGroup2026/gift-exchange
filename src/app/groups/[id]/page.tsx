import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SantaExchange } from "@/lib/types";
import { GroupDetail, type MemberView } from "./group-detail";

export const dynamic = "force-dynamic";

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", id)
    .order("created_at", { ascending: true });

  const uids = (members ?? []).filter((m) => m.user_id).map((m) => m.user_id);
  const { data: profs } = uids.length
    ? await supabase.from("profiles").select("id,display_name,email").in("id", uids)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  const memberViews: MemberView[] = (members ?? []).map((m) => {
    const p = m.user_id ? profMap.get(m.user_id) : null;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      name: p?.display_name ?? m.invited_email ?? "Someone",
      email: p?.email ?? m.invited_email ?? "",
      isSelf: m.user_id === user.id,
    };
  });

  const { data: exchanges } = await supabase
    .from("santa_exchanges")
    .select("*")
    .eq("group_id", id)
    .order("created_at", { ascending: false });

  return (
    <GroupDetail
      group={group}
      isOwner={group.owner_id === user.id}
      members={memberViews}
      exchanges={(exchanges ?? []) as SantaExchange[]}
      joinToken={group.join_token}
      origin={await siteOrigin()}
    />
  );
}
