// Functional test: group access + Secret Santa secrecy (the security-critical bits).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const failures = [];
const check = (n, c, d = "") => {
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
  if (!c) failures.push(n);
};
async function signIn(email) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "wishwell2026" });
  if (error) throw new Error(email + ": " + error.message);
  return c;
}

const { data: profs } = await admin
  .from("profiles")
  .select("id,email")
  .in("email", ["nora.owner@example.com", "gil.giver@example.com", "ivy.giver@example.com"]);
const id = (e) => profs.find((p) => p.email === e).id;
const nora = id("nora.owner@example.com"), gil = id("gil.giver@example.com"), ivy = id("ivy.giver@example.com");

let groupId, exId, listId;
try {
  const { data: g } = await admin
    .from("groups")
    .insert({ name: "[TEST] Santa Group", owner_id: nora, join_token: "test-" + Math.random().toString(36).slice(2) })
    .select().single();
  groupId = g.id;
  await admin.from("group_members").insert([
    { group_id: groupId, user_id: nora, role: "owner", status: "active" },
    { group_id: groupId, user_id: gil, role: "member", status: "active" },
    { group_id: groupId, user_id: ivy, role: "member", status: "active" },
  ]);

  // Share-to-group access
  const { data: l } = await admin.from("lists").insert({ owner_id: nora, title: "[TEST] Group List", status: "shared" }).select().single();
  listId = l.id;
  await admin.from("list_shares").insert({ list_id: listId, shared_with_group_id: groupId, source: "invite" });
  const gilC = await signIn("gil.giver@example.com");
  const { data: gilSees } = await gilC.from("lists").select("id").eq("id", listId);
  check("group member can access a group-shared list", (gilSees?.length ?? 0) === 1);

  // Secret Santa assignments (simulate a draw): nora->gil, gil->ivy, ivy->nora
  const { data: ex } = await admin
    .from("santa_exchanges")
    .insert({ group_id: groupId, organizer_id: nora, name: "[TEST] Draw", status: "assigned", assigned_at: new Date().toISOString() })
    .select().single();
  exId = ex.id;
  await admin.from("santa_participants").insert([
    { exchange_id: exId, user_id: nora }, { exchange_id: exId, user_id: gil }, { exchange_id: exId, user_id: ivy },
  ]);
  await admin.from("santa_assignments").insert([
    { exchange_id: exId, giver_user_id: nora, recipient_user_id: gil },
    { exchange_id: exId, giver_user_id: gil, recipient_user_id: ivy },
    { exchange_id: exId, giver_user_id: ivy, recipient_user_id: nora },
  ]);

  // Secrecy: a participant sees ONLY their own assignment.
  const { data: gilA } = await gilC.from("santa_assignments").select("giver_user_id,recipient_user_id").eq("exchange_id", exId);
  check("participant sees only their OWN assignment", (gilA?.length ?? 0) === 1 && gilA[0].giver_user_id === gil, `saw ${gilA?.length}`);
  check("participant's recipient is correct", gilA?.[0]?.recipient_user_id === ivy);

  const ivyC = await signIn("ivy.giver@example.com");
  const { data: ivyA } = await ivyC.from("santa_assignments").select("giver_user_id").eq("exchange_id", exId);
  check("another participant also sees only their own", (ivyA?.length ?? 0) === 1 && ivyA[0].giver_user_id === ivy);

  // Organizer can reveal all.
  const noraC = await signIn("nora.owner@example.com");
  const { data: noraA } = await noraC.from("santa_assignments").select("giver_user_id").eq("exchange_id", exId);
  check("organizer CAN see all assignments (reveal)", (noraA?.length ?? 0) === 3, `saw ${noraA?.length}`);
} finally {
  if (exId) await admin.from("santa_exchanges").delete().eq("id", exId);
  if (listId) await admin.from("lists").delete().eq("id", listId);
  if (groupId) await admin.from("groups").delete().eq("id", groupId);
}

console.log("");
if (failures.length) {
  console.error(`FUNCTIONAL GROUPS/SANTA TEST FAILED: ${failures.length}`);
  process.exit(1);
}
console.log("FUNCTIONAL GROUPS/SANTA TEST PASSED ✅");
