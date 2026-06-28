// READ-ONLY: compare template/legTemplate set-counts across live + backups.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
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

function summarize(label, data) {
  const s = data?.settings ?? {};
  console.log(`=== ${label} ===`);
  const both = [
    ...(s.templates ?? []).map((t) => ["T", t]),
    ...(s.legTemplates ?? []).map((t) => ["L", t]),
  ];
  for (const [kind, t] of both) {
    const ex = (t.exercises ?? [])
      .map((e) => `${e.id}=${e.sets}x${e.repsLow}-${e.repsHigh}`)
      .join(", ");
    console.log(`  [${kind}] ${t.name} (${t.category})${t.optional ? " *opt" : ""}: ${ex}`);
  }
  console.log("");
}

const live = await sql`SELECT data FROM user_state WHERE user_id='sam'`;
summarize("LIVE sam  (2026-06-27 15:43Z = Sun 01:43 AEST)", live[0].data);

const ids = [2681, 2653, 2559, 2449, 2437, 2327, 2211];
for (const id of ids) {
  const r =
    await sql`SELECT id, period_key, created_at, data FROM user_state_backups WHERE id=${id}`;
  if (r[0]) {
    summarize(
      `#${id} ${r[0].period_key} @ ${new Date(r[0].created_at).toISOString()}`,
      r[0].data
    );
  }
}
