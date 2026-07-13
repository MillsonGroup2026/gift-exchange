// Seed demo accounts + a testable demo scenario. Idempotent — safe to re-run.
// Run with: npm run seed
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// The person testing the app. Their real account is seeded with a shared list
// (to try the giver side) and an owned list with hidden claims (to prove the
// owner sees nothing).
const TESTER_EMAIL = "noah.conner@millson-group.com";

const SEED_USERS = [
  { email: "nora.owner@example.com", display_name: "Nora Owner" },
  { email: "gil.giver@example.com", display_name: "Gil Giver" },
  { email: "ivy.giver@example.com", display_name: "Ivy Giver" },
];

const rich = (html, text) => ({ html, text });

for (const u of SEED_USERS) {
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    email_confirm: true,
    user_metadata: { display_name: u.display_name },
  });
  if (error && !`${error.message}`.toLowerCase().includes("already") && error.status !== 422) {
    console.error(`ERROR ${u.email}: ${error.message}`);
  } else {
    console.log(`user ok: ${u.email}`);
  }
}

const { data: profs } = await admin
  .from("profiles")
  .select("id,email")
  .in("email", [...SEED_USERS.map((u) => u.email), TESTER_EMAIL]);
const idByEmail = Object.fromEntries((profs ?? []).map((p) => [p.email, p.id]));
const nora = idByEmail["nora.owner@example.com"];
const gil = idByEmail["gil.giver@example.com"];
const ivy = idByEmail["ivy.giver@example.com"];
const tester = idByEmail[TESTER_EMAIL] ?? null;

// Fresh demo data each run.
await admin.from("lists").delete().like("title", "[DEMO]%");

async function makeList(ownerId, title, occasion) {
  const { data } = await admin
    .from("lists")
    .insert({ owner_id: ownerId, title, occasion, status: "shared" })
    .select()
    .single();
  return data;
}
async function addItems(listId, rows) {
  const { data } = await admin
    .from("list_items")
    .insert(rows.map((r, i) => ({ list_id: listId, position: i + 1, ...r })))
    .select();
  return data;
}

// --- List A: Nora's list, shared with the tester (test the GIVER side) -------
const listA = await makeList(nora, "[DEMO] Nora's Birthday", "Birthday");
const aItems = await addItems(listA.id, [
  {
    title: "Noise-cancelling headphones",
    priority: 1,
    quantity: 1,
    url: "https://www.sony.com/headphones",
    link_meta: { title: "Sony WH-1000XM5", siteName: "sony.com" },
    description: rich("<p>Over-ear, <strong>black</strong> if there's a choice.</p>", "Over-ear, black if there's a choice."),
  },
  {
    title: "Cozy throw blanket",
    priority: 2,
    quantity: 1,
    description: rich("<p>Something soft for the couch — <em>chunky knit</em> would be dreamy.</p>", "Something soft for the couch."),
  },
  { title: "Whole-bean espresso", priority: 3, quantity: 2 },
  {
    title: "Board game night set",
    priority: 2,
    quantity: 1,
    description: rich("<p>Ideas:</p><ul><li>Wingspan</li><li>Codenames</li><li>Ticket to Ride</li></ul>", "Ideas: Wingspan, Codenames, Ticket to Ride"),
  },
]);
await admin.from("list_shares").insert(
  [
    { list_id: listA.id, shared_with_user_id: gil, source: "invite" },
    { list_id: listA.id, shared_with_user_id: ivy, source: "invite" },
    tester ? { list_id: listA.id, shared_with_email: TESTER_EMAIL, source: "invite" } : null,
  ].filter(Boolean),
);
await admin.from("claims").insert([
  { item_id: aItems[0].id, claimer_id: gil, quantity: 1, status: "planning" },
  { item_id: aItems[1].id, claimer_id: ivy, quantity: 1, status: "purchased" },
]);
await admin.from("comments").insert([
  { list_id: listA.id, item_id: aItems[0].id, author_id: gil, body: "Grabbing these — want to split the cost?" },
  { list_id: listA.id, item_id: null, author_id: ivy, body: "Should we do a group gift for the big item?" },
]);

// --- List B: owned by the tester, with HIDDEN claims (prove owner-blindness) -
if (tester) {
  const listB = await makeList(tester, "[DEMO] My Wishlist", "Just because");
  const bItems = await addItems(listB.id, [
    { title: "Trail running shoes", priority: 1, quantity: 1, description: rich("<p>Size 10.5</p>", "Size 10.5") },
    { title: "A good cookbook", priority: 2, quantity: 1 },
    { title: "Leather watch strap", priority: 3, quantity: 1 },
  ]);
  await admin.from("list_shares").insert([
    { list_id: listB.id, shared_with_user_id: gil, source: "invite" },
    { list_id: listB.id, shared_with_user_id: ivy, source: "invite" },
  ]);
  // Gil and Ivy secretly claim + comment — the tester (owner) must see NONE of this.
  await admin.from("claims").insert([
    { item_id: bItems[0].id, claimer_id: gil, quantity: 1, status: "purchased" },
    { item_id: bItems[1].id, claimer_id: ivy, quantity: 1, status: "planning" },
  ]);
  await admin.from("comments").insert([
    { list_id: listB.id, item_id: bItems[0].id, author_id: gil, body: "Already ordered these!" },
  ]);
  console.log(`seeded owner-blindness demo for ${TESTER_EMAIL}`);
} else {
  console.log(`(tester ${TESTER_EMAIL} not found yet — sign in once, then re-run seed for the owner-blindness demo)`);
}

console.log("\nseed complete.");
