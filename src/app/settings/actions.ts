"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setDefaultAnonymous(value: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({ default_anonymous: value })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}
