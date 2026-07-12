// Headless auth smoke test — proves the full magic-link loop without an inbox:
//   generate link (no email) -> verifyOtp establishes a session -> read own
//   auto-created profile through RLS.
// Run with: npm run smoke
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const email = process.argv[2] || "nora.owner@example.com";
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// generateLink does NOT send an email; it returns the token hash we'd get by
// clicking the emailed link. Use a fresh link per attempt (verify consumes it).
async function verifyOnce(type) {
  const { data: link, error: le } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (le) return { error: le };
  const token_hash = link.properties?.hashed_token;
  if (!token_hash) return { error: new Error("no hashed_token returned") };
  return anonClient.auth.verifyOtp({ type, token_hash });
}

let usedType = "email";
let { data: verifyData, error: verifyErr } = await verifyOnce("email");
if (verifyErr) {
  usedType = "magiclink";
  ({ data: verifyData, error: verifyErr } = await verifyOnce("magiclink"));
}
if (verifyErr) {
  console.error("verifyOtp error:", verifyErr.message);
  process.exit(1);
}
console.log(
  `1-2. magic-link sign-in works ✓ (type='${usedType}')  user: ${verifyData.user?.email}`,
);
console.log(
  `     session token: ${verifyData.session?.access_token ? "present ✓" : "MISSING ✗"}`,
);

const { data: prof, error: profErr } = await anonClient
  .from("profiles")
  .select("display_name, email")
  .eq("id", verifyData.user.id)
  .single();
if (profErr) {
  console.error("profile read error:", profErr.message);
  process.exit(1);
}
console.log(`3.   profile auto-created ✓  ${prof.display_name} <${prof.email}>`);
console.log("\nAUTH SMOKE TEST PASSED ✅");
