// Functional test: anonymous claims are redacted from OTHER givers (via list_claims),
// but the claimer still sees their own, and the owner sees nothing.
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

const { data: profs } = await admin.from("profiles").select("id,email").in("email", ["nora.owner@example.com", "gil.giver@example.com", "ivy.giver@example.com"]);
const id = (e) => profs.find((p) => p.email === e).id;
const nora = id("nora.owner@example.com"), gil = id("gil.giver@example.com"), ivy = id("ivy.giver@example.com");

let listId;
try {
  const { data: list } = await admin.from("lists").insert({ owner_id: nora, title: "[TEST] Anon", status: "shared" }).select().single();
  listId = list.id;
  await admin.from("list_shares").insert([
    { list_id: listId, shared_with_user_id: gil, source: "invite" },
    { list_id: listId, shared_with_user_id: ivy, source: "invite" },
  ]);
  const { data: items } = await admin.from("list_items").insert([
    { list_id: listId, title: "SecretGift", position: 1 },
    { list_id: listId, title: "OpenGift", position: 2 },
  ]).select();
  const secret = items.find((i) => i.title === "SecretGift");
  const open = items.find((i) => i.title === "OpenGift");

  const gilC = await signIn("gil.giver@example.com");
  let r = await gilC.rpc("claim_target", { p_item_id: secret.id, p_option_id: null, p_status: "planning", p_anonymous: true });
  check("anonymous claim succeeds", !r.error, r.error?.message);
  r = await gilC.rpc("claim_target", { p_item_id: open.id, p_option_id: null, p_status: "planning", p_anonymous: false });
  check("named claim succeeds", !r.error, r.error?.message);

  const ivyC = await signIn("ivy.giver@example.com");
  const { data: ivyClaims } = await ivyC.rpc("list_claims", { p_list_id: listId });
  const anonSeen = (ivyClaims ?? []).find((c) => c.item_id === secret.id);
  const namedSeen = (ivyClaims ?? []).find((c) => c.item_id === open.id);
  check("OTHER giver sees anonymous claim but NOT who", anonSeen && anonSeen.claimer_id === null && anonSeen.anonymous === true, JSON.stringify(anonSeen));
  check("OTHER giver sees the named claimer normally", namedSeen && namedSeen.claimer_id === gil, JSON.stringify(namedSeen));

  const { data: gilClaims } = await gilC.rpc("list_claims", { p_list_id: listId });
  const myAnon = (gilClaims ?? []).find((c) => c.item_id === secret.id);
  check("the claimer still sees their OWN anonymous claim", myAnon && myAnon.claimer_id === gil);

  const noraC = await signIn("nora.owner@example.com");
  const { data: noraClaims } = await noraC.rpc("list_claims", { p_list_id: listId });
  check("OWNER sees zero claims via list_claims", (noraClaims?.length ?? 0) === 0, `saw ${noraClaims?.length}`);
} finally {
  if (listId) await admin.from("lists").delete().eq("id", listId);
}

console.log("");
if (failures.length) {
  console.error(`FUNCTIONAL ANONYMITY TEST FAILED: ${failures.length}`);
  process.exit(1);
}
console.log("FUNCTIONAL ANONYMITY TEST PASSED ✅");
