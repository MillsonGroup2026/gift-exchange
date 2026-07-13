// PRIVACY REGRESSION TEST — the product's core guarantee.
// Seeds a shared list with claims + comments, then asserts the list OWNER reads
// zero claim/comment rows through every path, while a giver sees them. Also
// checks the atomic over-claim guard. Exits non-zero on any failure.
//
// Run: npm run test:privacy
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const failures = [];
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures.push(name);
}

// Authenticated client acting as `email` (magic link -> verifyOtp; no email sent).
async function userClient(email) {
  const { data: link, error: le } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (le) throw new Error(`generateLink ${email}: ${le.message}`);
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error) throw new Error(`verifyOtp ${email}: ${error.message}`);
  return c;
}

const OWNER = "nora.owner@example.com";
const GIL = "gil.giver@example.com";
const IVY = "ivy.giver@example.com";

let listId;
try {
  // --- Setup (as admin / service role) --------------------------------------
  const { data: profs } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", [OWNER, GIL, IVY]);
  const id = (e) => profs.find((p) => p.email === e).id;

  const { data: list } = await admin
    .from("lists")
    .insert({ owner_id: id(OWNER), title: "[REGRESSION] privacy check", occasion: "birthday", status: "shared" })
    .select()
    .single();
  listId = list.id;

  const { data: items } = await admin
    .from("list_items")
    .insert([
      { list_id: listId, title: "Item A", quantity: 2, position: 1 },
      { list_id: listId, title: "Item B", quantity: 1, position: 2 },
    ])
    .select();
  const itemA = items.find((i) => i.title === "Item A").id;
  const itemB = items.find((i) => i.title === "Item B").id;

  await admin.from("list_shares").insert([
    { list_id: listId, shared_with_user_id: id(GIL), source: "invite" },
    { list_id: listId, shared_with_user_id: id(IVY), source: "invite" },
  ]);
  await admin.from("claims").insert([
    { item_id: itemA, claimer_id: id(GIL), quantity: 1, status: "planning" },
    { item_id: itemB, claimer_id: id(IVY), quantity: 1, status: "purchased" },
  ]);
  await admin.from("comments").insert([
    { list_id: listId, item_id: itemA, author_id: id(GIL), body: "Grabbing this one!" },
    { list_id: listId, author_id: id(IVY), body: "Such a good list." },
  ]);

  // --- As the OWNER: must see ZERO claims/comments --------------------------
  const owner = await userClient(OWNER);
  const oClaims = await owner.from("claims").select("*");
  const oComments = await owner.from("comments").select("*");
  const oClaimsByItem = await owner.from("claims").select("*").in("item_id", [itemA, itemB]);
  const oList = await owner.from("lists").select("id").eq("id", listId);
  const oItems = await owner.from("list_items").select("id").eq("list_id", listId);

  check("owner reads 0 claims (all)", (oClaims.data?.length ?? -1) === 0, `got ${oClaims.data?.length}`);
  check("owner reads 0 comments (all)", (oComments.data?.length ?? -1) === 0, `got ${oComments.data?.length}`);
  check("owner reads 0 claims (filtered by own items)", (oClaimsByItem.data?.length ?? -1) === 0, `got ${oClaimsByItem.data?.length}`);
  check("owner CAN see their own list", (oList.data?.length ?? 0) === 1);
  check("owner CAN see their own items", (oItems.data?.length ?? 0) === 2);

  // --- As a GIVER: must see claims/comments ---------------------------------
  const gil = await userClient(GIL);
  const gClaims = await gil.from("claims").select("*");
  const gComments = await gil.from("comments").select("*");
  check("giver sees claims", (gClaims.data?.length ?? 0) >= 2, `got ${gClaims.data?.length}`);
  check("giver sees comments", (gComments.data?.length ?? 0) >= 2, `got ${gComments.data?.length}`);

  // --- Atomic over-claim guard ----------------------------------------------
  const over = await gil.rpc("claim_item", { p_item_id: itemB, p_quantity: 1 });
  check("over-claim on last unit is rejected", !!over.error, over.error?.message ?? "no error (BAD)");
} finally {
  if (listId) await admin.from("lists").delete().eq("id", listId);
}

console.log("");
if (failures.length) {
  console.error(`PRIVACY REGRESSION FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("PRIVACY REGRESSION PASSED ✅  (owner is fully excluded from claims/comments)");
