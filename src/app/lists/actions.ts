"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ClaimStatus, Priority, RichText } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function cleanDescription(desc: RichText): RichText {
  if (!desc || !desc.html?.trim()) return null;
  return { html: sanitizeHtml(desc.html), text: desc.text ?? "" };
}

// ---------------------------------------------------------------------------
// Lists (owner)
// ---------------------------------------------------------------------------
export async function createList(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim() || "My wishlist";
  const occasion = String(formData.get("occasion") ?? "").trim() || null;
  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: user.id, title, occasion, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect(`/lists/${data.id}`);
}

export async function updateListMeta(
  listId: string,
  patch: { title?: string; occasion?: string | null },
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("lists")
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() || "Untitled list" } : {}),
      ...(patch.occasion !== undefined ? { occasion: patch.occasion } : {}),
    })
    .eq("id", listId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteList(listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Items (owner)
// ---------------------------------------------------------------------------
export async function addItem(listId: string, title: string) {
  const { supabase } = await requireUser();
  const clean = title.trim();
  if (!clean) return { error: "Give the item a name." };
  const { data: last } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;
  const { data, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, title: clean, position })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true, item: data };
}

export async function updateItem(
  itemId: string,
  patch: {
    title?: string;
    description?: RichText;
    url?: string | null;
    link_meta?: unknown;
    priority?: Priority;
    quantity?: number;
  },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim() || "Untitled item";
  if (patch.description !== undefined) update.description = cleanDescription(patch.description);
  if (patch.url !== undefined) update.url = patch.url?.trim() || null;
  if (patch.link_meta !== undefined) update.link_meta = patch.link_meta;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.quantity !== undefined) update.quantity = Math.max(1, Math.floor(patch.quantity));

  const { data, error } = await supabase
    .from("list_items")
    .update(update)
    .eq("id", itemId)
    .select("list_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${data.list_id}`);
  return { ok: true };
}

export async function softDeleteItem(itemId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("list_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("list_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${data.list_id}`);
  return { ok: true };
}

export async function reorderItem(itemId: string, position: number) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("list_items")
    .update({ position })
    .eq("id", itemId)
    .select("list_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${data.list_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sharing (owner)
// ---------------------------------------------------------------------------
export async function createShareLink(listId: string) {
  const { supabase } = await requireUser();
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase
    .from("lists")
    .update({ public_share_token: token, status: "shared" })
    .eq("id", listId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true, token };
}

export async function revokeShareLink(listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("revoke_share_token", { p_list_id: listId });
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function shareWithEmail(listId: string, email: string) {
  const { supabase } = await requireUser();
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return { error: "Enter a valid email address." };
  }
  await supabase.from("lists").update({ status: "shared" }).eq("id", listId);
  const { data, error } = await supabase
    .from("list_shares")
    .insert({ list_id: listId, shared_with_email: clean, source: "invite" })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true, share: data };
}

export async function removeShare(shareId: string, listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("list_shares").delete().eq("id", shareId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function shareListToGroup(listId: string, groupId: string) {
  const { supabase } = await requireUser();
  const { data: existing } = await supabase
    .from("list_shares")
    .select("id")
    .eq("list_id", listId)
    .eq("shared_with_group_id", groupId)
    .maybeSingle();
  if (existing) return { error: "Already shared with that group." };

  await supabase.from("lists").update({ status: "shared" }).eq("id", listId);
  const { data, error } = await supabase
    .from("list_shares")
    .insert({ list_id: listId, shared_with_group_id: groupId, source: "invite" })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true, share: data };
}

export async function setListStatus(listId: string, status: "draft" | "shared") {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("lists").update({ status }).eq("id", listId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Claims & comments (giver)
// ---------------------------------------------------------------------------
export async function claimItem(
  itemId: string,
  listId: string,
  quantity: number,
  status: ClaimStatus,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("claim_item", {
    p_item_id: itemId,
    p_quantity: Math.max(1, Math.floor(quantity)),
    p_status: status,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("over_claim"))
      return { error: "Someone just claimed the last of these — the counts have updated." };
    if (msg.includes("owner_cannot_claim"))
      return { error: "You can't claim items on your own list." };
    if (msg.includes("no_access")) return { error: "You don't have access to this list." };
    return { error: "Couldn't claim that item. Please try again." };
  }
  revalidatePath(`/lists/${listId}`);
  return { ok: true, claim: data };
}

export async function updateClaim(
  claimId: string,
  listId: string,
  patch: { quantity?: number; status?: ClaimStatus },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.quantity !== undefined) update.quantity = Math.max(1, Math.floor(patch.quantity));
  if (patch.status !== undefined) update.status = patch.status;
  const { error } = await supabase.from("claims").update(update).eq("id", claimId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function releaseClaim(claimId: string, listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("claims").delete().eq("id", claimId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function addComment(
  listId: string,
  itemId: string | null,
  body: string,
) {
  const { supabase, user } = await requireUser();
  const clean = body.trim();
  if (!clean) return { error: "Write something first." };
  const { data, error } = await supabase
    .from("comments")
    .insert({ list_id: listId, item_id: itemId, author_id: user.id, body: clean })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true, comment: data };
}

export async function deleteComment(commentId: string, listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

export async function redeemShareToken(token: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("redeem_share_token", { p_token: token });
  if (error) return { error: error.message };
  return { ok: true, listId: data as string };
}
