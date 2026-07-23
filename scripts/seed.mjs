// Seed demo accounts (with passwords) + a testable demo scenario.
// Idempotent — safe to re-run. Run with: npm run seed
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Shared password for the demo accounts so any role can be tried by logging in.
const DEMO_PASSWORD = "wishwell2026";
// Real accounts to (re)enable with the demo password so they can sign in too.
const TESTER_EMAILS = ["noah.conner@millson-group.com", "2noahconner2@gmail.com"];

const SEED_USERS = [
  { email: "nora.owner@example.com", display_name: "Nora Owner" },
  { email: "gil.giver@example.com", display_name: "Gil Giver" },
  { email: "ivy.giver@example.com", display_name: "Ivy Giver" },
];

const rich = (html, text) => ({ html, text });

const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const byEmail = new Map((existingList?.users ?? []).map((u) => [(u.email ?? "").toLowerCase(), u]));

async function upsertUser(email, display_name) {
  const existing = byEmail.get(email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name },
    });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (error) {
    console.error(`create failed ${email}: ${error.message}`);
    return null;
  }
  return data.user.id;
}

const nora = await upsertUser("nora.owner@example.com", "Nora Owner");
const gil = await upsertUser("gil.giver@example.com", "Gil Giver");
const ivy = await upsertUser("ivy.giver@example.com", "Ivy Giver");
console.log(`demo users ready (password: ${DEMO_PASSWORD})`);

const testers = [];
for (const email of TESTER_EMAILS) {
  const existing = byEmail.get(email.toLowerCase());
  if (existing) {
    // IMPORTANT: never reset a real user's password here — doing so clobbers
    // whatever they set and locks them out. Only confirm the account.
    await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    testers.push({ email, id: existing.id });
    console.log(`found tester account: ${email} (password left untouched)`);
  }
}

// Fresh demo data each run.
await admin.from("lists").delete().like("title", "[DEMO]%");
await admin.from("groups").delete().like("name", "[DEMO]%");

async function makeList(ownerId, title, occasion) {
  const { data } = await admin
    .from("lists")
    .insert({ owner_id: ownerId, title, occasion, status: "shared" })
    .select()
    .single();
  return data;
}
async function addItems(listId, rows) {
  // Uniform keys for every row (PostgREST bulk insert requires it).
  const norm = rows.map((r, i) => ({
    list_id: listId,
    position: i + 1,
    title: r.title,
    description: r.description ?? null,
    links: r.links ?? [],
    priority: r.priority ?? 2,
    quantity: r.quantity ?? 1,
  }));
  const { data, error } = await admin.from("list_items").insert(norm).select();
  if (error) {
    console.error("addItems error:", error.message);
    process.exit(1);
  }
  return data;
}

async function addOptions(itemId, opts) {
  const { data, error } = await admin
    .from("list_item_options")
    .insert(opts.map((o, i) => ({ item_id: itemId, position: i, name: o.name ?? null, url: o.url ?? null, link_meta: o.link_meta ?? null })))
    .select();
  if (error) {
    console.error("addOptions error:", error.message);
    process.exit(1);
  }
  return data;
}

// --- List A: Nora owns it. Log in as Nora => owner sees no claims. Log in as
//     Gil/Ivy (or your own shared account) => giver view with live claims. -----
const listA = await makeList(nora, "[DEMO] Nora's Birthday", "Birthday");
const aItems = await addItems(listA.id, [
  {
    title: "Noise-cancelling headphones",
    priority: 1,
    description: rich("<p>Over-ear, <strong>black</strong> if there's a choice. Either brand works!</p>", "Over-ear, black if there's a choice."),
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
    description: rich("<p>Any of these would be great:</p>", "Any of these would be great"),
  },
]);
const aOptions = await addOptions(aItems[0].id, [
  { name: "Sony WH-1000XM5", url: "https://www.sony.com/electronics/headband-headphones", link_meta: { title: "Sony WH-1000XM5", siteName: "sony.com" } },
  { name: "Bose QuietComfort Ultra", url: "https://www.bose.com/p/headphones", link_meta: { title: "Bose QuietComfort Ultra", siteName: "bose.com" } },
]);
await addOptions(aItems[3].id, [{ name: "Wingspan" }, { name: "Codenames" }, { name: "Ticket to Ride" }]);
await admin.from("list_shares").insert([
  { list_id: listA.id, shared_with_user_id: gil, source: "invite" },
  { list_id: listA.id, shared_with_user_id: ivy, source: "invite" },
  ...TESTER_EMAILS.map((email) => ({ list_id: listA.id, shared_with_email: email, source: "invite" })),
]);
await admin.from("claims").insert([
  { item_id: aItems[0].id, option_id: aOptions[0].id, claimer_id: gil, quantity: 1, status: "planning" },
  { item_id: aItems[1].id, claimer_id: ivy, quantity: 1, status: "purchased" },
]);
await admin.from("comments").insert([
  { list_id: listA.id, item_id: aItems[0].id, author_id: gil, body: "Grabbing these — want to split the cost?" },
  { list_id: listA.id, item_id: null, author_id: ivy, body: "Should we do a group gift for the big item?" },
]);

// --- List B: owned by each tester account, with HIDDEN claims (owner-blindness) -
for (const t of testers) {
  const listB = await makeList(t.id, "[DEMO] My Wishlist", "Just because");
  const bItems = await addItems(listB.id, [
    { title: "Trail running shoes", priority: 1, quantity: 1, description: rich("<p>Size 10.5</p>", "Size 10.5") },
    { title: "A good cookbook", priority: 2, quantity: 1 },
    { title: "Leather watch strap", priority: 3, quantity: 1 },
  ]);
  await admin.from("list_shares").insert([
    { list_id: listB.id, shared_with_user_id: gil, source: "invite" },
    { list_id: listB.id, shared_with_user_id: ivy, source: "invite" },
  ]);
  await admin.from("claims").insert([
    { item_id: bItems[0].id, claimer_id: gil, quantity: 1, status: "purchased" },
    { item_id: bItems[1].id, claimer_id: ivy, quantity: 1, status: "planning" },
  ]);
  await admin.from("comments").insert([
    { list_id: listB.id, item_id: bItems[0].id, author_id: gil, body: "Already ordered these!" },
  ]);
  console.log(`seeded owner-blindness demo owned by ${t.email}`);
}

// --- Demo group + Secret Santa (draft, ready to draw). --------------------
const { data: dgroup } = await admin
  .from("groups")
  .insert({ name: "[DEMO] Conner × Lake", owner_id: nora, join_token: "demo-" + Math.random().toString(36).slice(2) })
  .select()
  .single();
await admin.from("group_members").insert([
  { group_id: dgroup.id, user_id: nora, role: "owner", status: "active" },
  { group_id: dgroup.id, user_id: gil, role: "member", status: "active" },
  { group_id: dgroup.id, user_id: ivy, role: "member", status: "active" },
  ...testers.map((t) => ({ group_id: dgroup.id, user_id: t.id, role: "member", status: "active" })),
]);
const { data: dex } = await admin
  .from("santa_exchanges")
  .insert({ group_id: dgroup.id, organizer_id: nora, name: "[DEMO] Family Secret Santa" })
  .select()
  .single();
await admin.from("santa_participants").insert([
  { exchange_id: dex.id, user_id: nora, team: "Conners" },
  { exchange_id: dex.id, user_id: gil, team: "Conners" },
  { exchange_id: dex.id, user_id: ivy, team: "Lake" },
  ...testers.map((t, i) => ({ exchange_id: dex.id, user_id: t.id, team: i % 2 === 0 ? "Lake" : "Conners" })),
]);
await admin.from("santa_rules").insert([
  { exchange_id: dex.id, from_team: "Conners", to_team: "Lake" },
  { exchange_id: dex.id, from_team: "Lake", to_team: "Conners" },
]);
console.log("seeded demo group + Secret Santa (draft, organizer nora.owner@example.com)");

console.log("\nDemo logins (all password: " + DEMO_PASSWORD + "):");
console.log("  nora.owner@example.com  — owns 'Nora's Birthday' (test owner-blindness)");
console.log("  gil.giver@example.com   — giver on both demo lists");
console.log("  ivy.giver@example.com   — giver on both demo lists");
console.log("\nseed complete.");
