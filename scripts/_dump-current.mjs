// READ-ONLY DB + local file write: snapshot current live `sam` state to JSON
// as a safety backup before any restore.
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(here, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let value = m[2];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}

const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT data, updated_at FROM user_state WHERE user_id='sam'`;
const out = resolve(here, "_sam-before-restore-2026-06-28.json");
writeFileSync(out, JSON.stringify(r[0].data));
console.log(
  `saved ${out}\n  bytes=${JSON.stringify(r[0].data).length} updated_at=${new Date(
    r[0].updated_at
  ).toISOString()}`
);
