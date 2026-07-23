// Functional test: sub-item (option) claiming + owner-blindness still holds.
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

let listId;
try {
  const { data: list } = await admin
    .from("lists")
    .insert({ owner_id: nora, title: "[TEST] Options", status: "shared" })
    .select().single();
  listId = list.id;
  await admin.from("list_shares").insert([
    { list_id: listId, shared_with_user_id: gil, source: "invite" },
    { list_id: listId, shared_with_user_id: ivy, source: "invite" },
  ]);
  const { data: items } = await admin
    .from("list_items")
    .insert([{ list_id: listId, title: "Jersey", position: 1 }, { list_id: listId, title: "iPhone", position: 2 }])
    .select();
  const jersey = items.find((i) => i.title === "Jersey");
  const iphone = items.find((i) => i.title === "iPhone");
  const { data: opts } = await admin
    .from("list_item_options")
    .insert([{ item_id: jersey.id, name: "Judge", position: 0 }, { item_id: jersey.id, name: "Stanton", position: 1 }])
    .select();

  const gilC = await signIn("gil.giver@example.com");
  let r = await gilC.rpc("claim_target", { p_item_id: jersey.id, p_option_id: opts[0].id, p_status: "planning" });
  check("giver claims a sub-item", !r.error, r.error?.message);
  r = await gilC.rpc("claim_target", { p_item_id: jersey.id, p_option_id: null, p_status: "planning" });
  check("whole-claim blocked when item has sub-items", /has_options/.test(r.error?.message || ""), r.error?.message);
  r = await gilC.rpc("claim_target", { p_item_id: iphone.id, p_option_id: null, p_status: "planning" });
  check("giver claims a whole item that has no sub-items", !r.error, r.error?.message);

  const ivyC = await signIn("ivy.giver@example.com");
  r = await ivyC.rpc("claim_target", { p_item_id: jersey.id, p_option_id: opts[0].id, p_status: "planning" });
  check("double-claim of the SAME sub-item is blocked", /already_claimed/.test(r.error?.message || ""), r.error?.message);
  r = await ivyC.rpc("claim_target", { p_item_id: jersey.id, p_option_id: opts[1].id, p_status: "planning" });
  check("another giver claims the OTHER sub-item", !r.error, r.error?.message);

  const noraC = await signIn("nora.owner@example.com");
  r = await noraC.rpc("claim_target", { p_item_id: jersey.id, p_option_id: opts[1].id, p_status: "planning" });
  check("owner cannot claim", /owner_cannot_claim/.test(r.error?.message || ""), r.error?.message);
  const itemIds = [jersey.id, iphone.id];
  const { data: ownerClaims } = await noraC.from("claims").select("id").in("item_id", itemIds);
  check("OWNER still sees ZERO claims (privacy holds with sub-items)", (ownerClaims?.length ?? 0) === 0, `saw ${ownerClaims?.length}`);
  const { data: gilClaims } = await gilC.from("claims").select("id").in("item_id", itemIds);
  check("givers see the claims", (gilClaims?.length ?? 0) === 3, `saw ${gilClaims?.length}`);
} finally {
  if (listId) await admin.from("lists").delete().eq("id", listId);
}

console.log("");
if (failures.length) {
  console.error(`FUNCTIONAL OPTIONS TEST FAILED: ${failures.length}`);
  process.exit(1);
}
console.log("FUNCTIONAL OPTIONS TEST PASSED ✅");
