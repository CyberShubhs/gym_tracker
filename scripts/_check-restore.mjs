// READ-ONLY: full comparison of live `sam` vs backup #2653 (Fri 16:16 AEST) —
// version flags, template structure, schedule/cycle, and log/collection counts.
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

const flag = (d) => {
  const s = d.settings ?? {};
  return {
    templatesVersion: s.templatesVersion,
    userTemplatesSeededVersion: s.userTemplatesSeededVersion,
    legDayMergeVersion: s.legDayMergeVersion,
    legTemplatesSeededVersion: s.legTemplatesSeededVersion,
    nTemplates: (s.templates ?? []).length,
    nLegTemplates: (s.legTemplates ?? []).length,
    nCustomFoods: (s.customFoods ?? []).length,
    nRecipes: (s.recipes ?? []).length,
    nExerciseNotes: Object.keys(s.exerciseNotes ?? {}).length,
    cycle: s.cycle,
    cycleAnchor: s.cycleAnchor,
    nCycleSegments: (s.cycleSegments ?? []).length,
    schedule: s.schedule,
  };
};
console.log("LIVE flags:", JSON.stringify(flag(live), null, 1));
console.log("\n#2653 flags:", JSON.stringify(flag(ref), null, 1));

console.log("\nLOG COUNTS  live vs ref:");
for (const k of ["workoutLogs", "foodLogs", "weightLogs", "appleHealthDaily"]) {
  console.log(`  ${k}: live=${Object.keys(live[k] ?? {}).length} ref=${Object.keys(ref[k] ?? {}).length}`);
}

const tkey = (t) => `${t.id}|${t.name}`;
const liveT = new Map((live.settings.templates ?? []).map((t) => [tkey(t), t]));
const refT = new Map((ref.settings.templates ?? []).map((t) => [tkey(t), t]));
console.log("\nTEMPLATE-LEVEL DIFF (live vs #2653):");
const allKeys = new Set([...liveT.keys(), ...refT.keys()]);
for (const k of allKeys) {
  const a = liveT.get(k), b = refT.get(k);
  if (!a) { console.log(`  ONLY in #2653: ${k}`); continue; }
  if (!b) { console.log(`  ONLY in live : ${k}`); continue; }
  const exA = (a.exercises ?? []).map((e) => `${e.id}:${e.sets}`).join(",");
  const exB = (b.exercises ?? []).map((e) => `${e.id}:${e.sets}`).join(",");
  if (exA !== exB) {
    console.log(`  DIFF ${k}`);
    console.log(`     live : ${exA}`);
    console.log(`     #2653: ${exB}`);
  }
}
console.log("\nTemplate ORDER:");
console.log("  live :", (live.settings.templates ?? []).map((t) => t.name).join(" | "));
console.log("  #2653:", (ref.settings.templates ?? []).map((t) => t.name).join(" | "));
