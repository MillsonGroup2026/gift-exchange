import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import type { SantaExclusion, SantaRule } from "@/lib/types";
import { SantaOrganizer, type Candidate, type ParticipantView } from "./santa-organizer";
import { SantaReveal, type Assignment, type Recipient } from "./santa-reveal";

export const dynamic = "force-dynamic";

export default async function SantaPage({
  params,
}: {
  params: Promise<{ id: string; exchangeId: string }>;
}) {
  const { id: groupId, exchangeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exchange } = await supabase
    .from("santa_exchanges")
    .select("*")
    .eq("id", exchangeId)
    .maybeSingle();
  if (!exchange) notFound();

  const isOrganizer = exchange.organizer_id === user.id;

  const { data: gm } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", exchange.group_id)
    .eq("status", "active");
  const memberIds = (gm ?? []).map((m) => m.user_id).filter(Boolean) as string[];

  const { data: parts } = await supabase
    .from("santa_participants")
    .select("*")
    .eq("exchange_id", exchangeId);

  const allIds = [...new Set([...memberIds, ...(parts ?? []).map((p) => p.user_id)])];
  const { data: profs } = allIds.length
    ? await supabase.from("profiles").select("id,display_name,email").in("id", allIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
  const nameOf = (uid: string) => (profs ?? []).find((p) => p.id === uid)?.display_name ?? "Someone";
  const emailOf = (uid: string) => (profs ?? []).find((p) => p.id === uid)?.email ?? "";

  const candidates: Candidate[] = memberIds.map((uid) => ({
    user_id: uid,
    name: nameOf(uid),
    email: emailOf(uid),
  }));
  const participants: ParticipantView[] = (parts ?? []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    team: p.team,
    name: nameOf(p.user_id),
    email: emailOf(p.user_id),
  }));

  let rules: SantaRule[] = [];
  let exclusions: SantaExclusion[] = [];
  let allAssignments: Assignment[] | null = null;
  if (isOrganizer) {
    rules = ((await supabase.from("santa_rules").select("*").eq("exchange_id", exchangeId)).data ?? []) as SantaRule[];
    exclusions = ((await supabase.from("santa_exclusions").select("*").eq("exchange_id", exchangeId)).data ?? []) as SantaExclusion[];
    if (exchange.status === "assigned") {
      const { data: all } = await supabase
        .from("santa_assignments")
        .select("giver_user_id,recipient_user_id")
        .eq("exchange_id", exchangeId);
      allAssignments = (all ?? []).map((a) => ({
        giver: nameOf(a.giver_user_id),
        recipient: nameOf(a.recipient_user_id),
      }));
    }
  }

  let recipient: Recipient | null = null;
  if (exchange.status === "assigned") {
    const { data: mine } = await supabase
      .from("santa_assignments")
      .select("recipient_user_id")
      .eq("exchange_id", exchangeId)
      .eq("giver_user_id", user.id)
      .maybeSingle();
    if (mine) {
      const rid = mine.recipient_user_id;
      const { data: rlists } = await supabase
        .from("lists")
        .select("id,title")
        .eq("owner_id", rid)
        .eq("status", "shared");
      recipient = {
        name: nameOf(rid),
        email: emailOf(rid),
        lists: (rlists ?? []) as { id: string; title: string }[],
      };
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href={`/groups/${groupId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Group
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Secret Santa</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{exchange.name}</h1>
        </div>

        {exchange.status === "assigned" ? (
          <SantaReveal recipient={recipient} isOrganizer={isOrganizer} allAssignments={allAssignments} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">
            {isOrganizer
              ? "Set up participants and rules below, then draw names."
              : "The organizer hasn't drawn names yet — check back soon."}
          </div>
        )}

        {isOrganizer && (
          <SantaOrganizer
            exchangeId={exchangeId}
            status={exchange.status}
            candidates={candidates}
            initialParticipants={participants}
            initialRules={rules}
            initialExclusions={exclusions}
          />
        )}
      </main>
    </div>
  );
}
