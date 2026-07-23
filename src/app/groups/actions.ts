"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drawSanta } from "@/lib/santa";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
export async function createGroup(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Group needs a name.");
  const token = randomBytes(18).toString("base64url");
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, owner_id: user.id, join_token: token })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("group_members")
    .insert({ group_id: data.id, user_id: user.id, role: "owner", status: "active" });
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function renameGroup(groupId: string, name: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("groups").update({ name: name.trim() || "Untitled group" }).eq("id", groupId);
  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteGroup(groupId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function inviteToGroup(groupId: string, email: string) {
  const { supabase } = await requireUser();
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { error: "Enter a valid email address." };

  // If the email already belongs to a user, add them as an active member.
  const { data: prof } = await supabase.from("profiles").select("id").eq("email", clean).maybeSingle();
  const row: {
    group_id: string;
    user_id: string | null;
    invited_email: string | null;
    status: "active" | "invited";
    role: "member";
  } = prof
    ? { group_id: groupId, user_id: prof.id, invited_email: null, status: "active", role: "member" }
    : { group_id: groupId, user_id: null, invited_email: clean, status: "invited", role: "member" };

  const { data, error } = await supabase.from("group_members").insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") return { error: "That person is already in the group." };
    return { error: error.message };
  }
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, member: data };
}

export async function removeMember(memberId: string, groupId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("group_members").delete().eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function leaveGroup(groupId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function rotateJoinToken(groupId: string) {
  const { supabase } = await requireUser();
  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("groups").update({ join_token: token }).eq("id", groupId);
  if (error) return { error: error.message };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, token };
}

export async function joinGroupViaToken(token: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("join_group_via_token", { p_token: token });
  if (error) return { error: error.message };
  return { ok: true, groupId: data as string };
}

export async function claimGroupInvites() {
  const { supabase } = await requireUser();
  await supabase.rpc("claim_group_invites");
}

// ---------------------------------------------------------------------------
// Secret Santa
// ---------------------------------------------------------------------------
export async function createExchange(groupId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "Secret Santa";
  const { data, error } = await supabase
    .from("santa_exchanges")
    .insert({ group_id: groupId, organizer_id: user.id, name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/santa/${data.id}`);
}

export async function deleteExchange(exchangeId: string, groupId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("santa_exchanges").delete().eq("id", exchangeId);
  if (error) throw new Error(error.message);
  redirect(`/groups/${groupId}`);
}

export async function setParticipants(exchangeId: string, userIds: string[]) {
  const { supabase } = await requireUser();
  // Replace the participant set with the given users (teams preserved for kept ones).
  const { data: existing } = await supabase
    .from("santa_participants")
    .select("id,user_id,team")
    .eq("exchange_id", exchangeId);
  const keep = new Set(userIds);
  const have = new Map((existing ?? []).map((p) => [p.user_id, p]));

  const toRemove = (existing ?? []).filter((p) => !keep.has(p.user_id)).map((p) => p.id);
  const toAdd = userIds.filter((id) => !have.has(id)).map((id) => ({ exchange_id: exchangeId, user_id: id }));

  if (toRemove.length) await supabase.from("santa_participants").delete().in("id", toRemove);
  if (toAdd.length) await supabase.from("santa_participants").insert(toAdd);
  const { data: current } = await supabase
    .from("santa_participants")
    .select("id,user_id,team")
    .eq("exchange_id", exchangeId);
  revalidatePathForExchange(exchangeId);
  return { ok: true, participants: current ?? [] };
}

export async function setParticipantTeam(participantId: string, exchangeId: string, team: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("santa_participants")
    .update({ team: team.trim() || null })
    .eq("id", participantId);
  if (error) return { error: error.message };
  revalidatePathForExchange(exchangeId);
  return { ok: true };
}

export async function addRule(exchangeId: string, fromTeam: string, toTeam: string) {
  const { supabase } = await requireUser();
  const f = fromTeam.trim();
  const t = toTeam.trim();
  if (!f || !t) return { error: "Pick both teams." };
  const { data, error } = await supabase
    .from("santa_rules")
    .insert({ exchange_id: exchangeId, from_team: f, to_team: t })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That rule already exists." };
    return { error: error.message };
  }
  revalidatePathForExchange(exchangeId);
  return { ok: true, rule: data };
}

export async function removeRule(ruleId: string, exchangeId: string) {
  const { supabase } = await requireUser();
  await supabase.from("santa_rules").delete().eq("id", ruleId);
  revalidatePathForExchange(exchangeId);
  return { ok: true };
}

export async function addExclusion(exchangeId: string, giver: string, recipient: string) {
  const { supabase } = await requireUser();
  if (!giver || !recipient || giver === recipient) return { error: "Pick two different people." };
  const { data, error } = await supabase
    .from("santa_exclusions")
    .insert({ exchange_id: exchangeId, giver_user_id: giver, recipient_user_id: recipient })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That block already exists." };
    return { error: error.message };
  }
  revalidatePathForExchange(exchangeId);
  return { ok: true, exclusion: data };
}

export async function removeExclusion(exclusionId: string, exchangeId: string) {
  const { supabase } = await requireUser();
  await supabase.from("santa_exclusions").delete().eq("id", exclusionId);
  revalidatePathForExchange(exchangeId);
  return { ok: true };
}

export async function generateAssignments(exchangeId: string) {
  const { supabase, user } = await requireUser();
  const { data: ex } = await supabase
    .from("santa_exchanges")
    .select("id,organizer_id,group_id")
    .eq("id", exchangeId)
    .maybeSingle();
  if (!ex) return { error: "Exchange not found." };
  if (ex.organizer_id !== user.id) return { error: "Only the organizer can draw names." };

  const admin = createAdminClient();
  const [{ data: parts }, { data: rules }, { data: excls }] = await Promise.all([
    admin.from("santa_participants").select("user_id,team").eq("exchange_id", exchangeId),
    admin.from("santa_rules").select("from_team,to_team").eq("exchange_id", exchangeId),
    admin.from("santa_exclusions").select("giver_user_id,recipient_user_id").eq("exchange_id", exchangeId),
  ]);
  if (!parts || parts.length < 2) return { error: "Add at least two participants first." };

  const result = drawSanta(parts, rules ?? [], excls ?? []);
  if (!result.ok) {
    const { data: p } = await admin.from("profiles").select("display_name").eq("id", result.blockedUserId).maybeSingle();
    return {
      error: `Couldn't find an eligible match for ${p?.display_name ?? "someone"}. Loosen the team rules or blocks and try again.`,
    };
  }

  await admin.from("santa_assignments").delete().eq("exchange_id", exchangeId);
  const { error: insErr } = await admin
    .from("santa_assignments")
    .insert(result.assignments.map((a) => ({ exchange_id: exchangeId, ...a })));
  if (insErr) return { error: insErr.message };
  await admin
    .from("santa_exchanges")
    .update({ status: "assigned", assigned_at: new Date().toISOString() })
    .eq("id", exchangeId);

  revalidatePath(`/groups/${ex.group_id}/santa/${exchangeId}`);
  return { ok: true };
}

function revalidatePathForExchange(exchangeId: string) {
  // Path needs the group id; the caller pages revalidate anyway. This keeps the
  // exchange page fresh via its dynamic segment.
  revalidatePath(`/groups`, "layout");
}
