// Seed demo accounts. Idempotent — safe to re-run.
// Run with: npm run seed   (loads .env.local via --env-file)
//
// Phase 1 seeds the three core people. Groups, lists, and claims are added to
// this script as those tables land in later phases.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The list owner (Nora) plus two givers. Magic-link only, so no passwords —
// email_confirm makes them usable immediately without sending mail.
export const SEED_USERS = [
  { email: "nora.owner@example.com", display_name: "Nora Owner" },
  { email: "gil.giver@example.com", display_name: "Gil Giver" },
  { email: "ivy.giver@example.com", display_name: "Ivy Giver" },
];

for (const u of SEED_USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    email_confirm: true,
    user_metadata: { display_name: u.display_name },
  });
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("already") || error.status === 422) {
      console.log(`exists : ${u.email}`);
    } else {
      console.error(`ERROR  : ${u.email} -> ${error.message}`);
    }
  } else {
    console.log(`created: ${u.email} (${data.user.id})`);
  }
}

const { data: profiles, error: pErr } = await admin
  .from("profiles")
  .select("email, display_name")
  .order("email");
if (pErr) {
  console.error("profiles query error:", pErr.message);
  process.exit(1);
}
console.log(`\nprofiles rows (${profiles.length}):`);
for (const p of profiles) console.log(` - ${p.display_name} <${p.email}>`);
