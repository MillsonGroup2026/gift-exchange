// Apply SQL to the Supabase project via the Management API (over HTTPS — no DB
// networking or interactive prompts). Uses only Node built-ins.
//   SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... node scripts/db-apply.mjs <file.sql | -e "SQL">
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.PROJECT_REF;
if (!token || !ref) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or PROJECT_REF");
  process.exit(1);
}

let query;
if (process.argv[2] === "-e") query = process.argv[3];
else if (process.argv[2]) query = readFileSync(process.argv[2], "utf8");
else {
  console.error("usage: db-apply.mjs <file.sql | -e 'SQL'>");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 4000));
if (!res.ok) process.exit(1);
