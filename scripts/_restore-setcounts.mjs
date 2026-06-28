// Restore the planning block (templates/schedule/cycle/cycleAnchor/cycleSegments)
// for `sam` from backup #2653 (Fri 16:16 AEST, last pre-reset snapshot) onto the
// CURRENT live data — preserving ALL logs and every other setting. Writes a
// PROTECTED pre-restore backup of current state first. DRY-RUN unless --apply.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(here, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const sql = neon(process.env.DATABASE_URL);

const live = (await sql`SELECT data FROM user_state WHERE user_id='sam'`)[0].data;
const ref = (await sql`SELECT data FROM user_state_backups WHERE id=2653`)[0].data;

const PLANNING = ["templates", "schedule", "cycle", "cycleAnchor", "cycleSegments"];
const newSettings = { ...live.settings };
for (const k of PLANNING) {
  if (k in ref.settings) newSettings[k] = ref.settings[k];
  else delete newSettings[k];
}
const next = { ...live, settings: newSettings };

const assert = (c, m) => { if (!c) throw new Error("ASSERT FAILED: " + m); };
assert(Array.isArray(next.settings.templates) && next.settings.templates.length === 8, "8 templates");
assert(next.settings.userTemplatesSeededVersion === 4, "seededVersion=4 (persists)");
assert(next.settings.templatesVersion === 4, "templatesVersion=4");
assert(next.settings.schedule && typeof next.settings.schedule === "object", "schedule object");
const keep = (k) => assert(
  Object.keys(next[k] ?? {}).length === Object.keys(live[k] ?? {}).length,
  `${k} preserved (${Object.keys(live[k] ?? {}).length})`
);
keep("workoutLogs"); keep("foodLogs"); keep("weightLogs"); keep("appleHealthDaily");
assert((next.settings.customFoods ?? []).length === (live.settings.customFoods ?? []).length, "customFoods preserved (26)");
assert((next.settings.recipes ?? []).length === (live.settings.recipes ?? []).length, "recipes preserved");

console.log("RESULT templates (set counts):");
for (const t of next.settings.templates) {
  console.log(`  ${t.name}: ${(t.exercises ?? []).map((e) => `${e.id}=${e.sets}`).join(", ")}`);
}
console.log("\nRESULT schedule:", JSON.stringify(next.settings.schedule));
console.log("RESULT cycle:", JSON.stringify(next.settings.cycle), "anchor:", next.settings.cycleAnchor, "segments:", (next.settings.cycleSegments ?? []).length);
console.log(
  `RESULT preserved: workouts=${Object.keys(next.workoutLogs).length} food=${Object.keys(next.foodLogs).length} weight=${Object.keys(next.weightLogs).length} customFoods=${(next.settings.customFoods ?? []).length}`
);
console.log(`payload bytes=${JSON.stringify(next).length}`);

if (!process.argv.includes("--apply")) {
  console.log("\n*** DRY RUN — no writes. Re-run with --apply to commit. ***");
  process.exit(0);
}

const pk = "pre-setcount-restore-" + new Date().toISOString();
await sql`
  INSERT INTO user_state_backups (user_id, kind, period_key, data, source, protected)
  VALUES ('sam','manual',${pk},${JSON.stringify(live)}::jsonb,'manual:pre-setcount-restore',true)
  ON CONFLICT (user_id, kind, period_key) DO UPDATE SET data = EXCLUDED.data`;
console.log("\n✓ wrote PROTECTED pre-restore backup:", pk);

await sql`UPDATE user_state SET data = ${JSON.stringify(next)}::jsonb, updated_at = now() WHERE user_id = 'sam'`;
console.log("✓ UPDATED user_state for sam");
