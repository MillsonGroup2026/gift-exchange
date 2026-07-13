// Functional test of the sharing/access model the UI relies on.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const failures = [];
const check = (n, c, d = "") => {
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
  if (!c) failures.push(n);
};

async function userClient(email) {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await c.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  return c;
}

let listId;
try {
  const { data: profs } = await admin
    .from("profiles")
    .select("id,email")
    .in("email", ["nora.owner@example.com", "gil.giver@example.com", "ivy.giver@example.com"]);
  const id = (e) => profs.find((p) => p.email === e).id;

  const token = "functest-" + Math.random().toString(36).slice(2, 12);
  const { data: list } = await admin
    .from("lists")
    .insert({ owner_id: id("nora.owner@example.com"), title: "[FUNC] share test", status: "shared", public_share_token: token })
    .select()
    .single();
  listId = list.id;
  await admin.from("list_items").insert([{ list_id: listId, title: "Cast-iron pan", quantity: 1, position: 1 }]);

  // Anonymous public-link fetch
  const pub = await anon.rpc("get_shared_list", { p_token: token });
  check("anon get_shared_list returns the list", pub.data?.list?.title === "[FUNC] share test");
  check("anon get_shared_list returns items", (pub.data?.items?.length ?? 0) === 1);

  // Anonymous cannot read tables directly
  const anonList = await anon.from("lists").select("id").eq("id", listId);
  check("anon cannot read lists table directly", (anonList.data?.length ?? 0) === 0);

  // Giver redeems the link -> gains access
  const gil = await userClient("gil.giver@example.com");
  const red = await gil.rpc("redeem_share_token", { p_token: token });
  check("redeem_share_token returns list id", red.data === listId, red.error?.message ?? "");
  const gilSees = await gil.from("lists").select("id").eq("id", listId);
  check("giver has access after redeeming link", (gilSees.data?.length ?? 0) === 1);

  // Email invite -> access on sign-in
  await admin.from("list_shares").insert({ list_id: listId, shared_with_email: "ivy.giver@example.com", source: "invite" });
  const ivy = await userClient("ivy.giver@example.com");
  const ivySees = await ivy.from("lists").select("id").eq("id", listId);
  check("email-invited giver has access", (ivySees.data?.length ?? 0) === 1);

  // Revoke kills link access
  await admin.rpc("revoke_share_token", { p_list_id: listId }); // note: runs as admin, is_list_owner false -> should raise
  // Instead revoke as the owner:
  const nora = await userClient("nora.owner@example.com");
  await nora.rpc("revoke_share_token", { p_list_id: listId });
  const afterRevoke = await anon.rpc("get_shared_list", { p_token: token });
  check("revoked link no longer resolves", !afterRevoke.data);
} finally {
  if (listId) await admin.from("lists").delete().eq("id", listId);
}

console.log("");
if (failures.length) {
  console.error(`FUNCTIONAL SHARE TEST FAILED: ${failures.length}`);
  process.exit(1);
}
console.log("FUNCTIONAL SHARE TEST PASSED ✅");
