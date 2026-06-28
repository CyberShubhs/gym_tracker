import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(here, "..", ".env.local"), "utf8");
for (const l of env.split("\n")) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT data FROM user_state WHERE user_id = 'sam'`;
const d = r[0].data;
console.log("goalWeightKg:", d.settings.goalWeightKg);
console.log("dob/sex:", d.settings.dob, d.settings.sex);
console.log("customFoods:", (d.settings.customFoods || []).length);
console.log("recipes:", (d.settings.recipes || []).map((x) => x.name));
console.log("templates:", (d.settings.templates || []).length, "legTemplates:", (d.settings.legTemplates || []).length);
console.log("exerciseNotes keys:", Object.keys(d.settings.exerciseNotes || {}).length);
console.log("foodOverrides:", Object.keys(d.settings.foodOverrides || {}));
console.log("sample workout 2026-05-19 bench[0]:", JSON.stringify(d.workoutLogs["2026-05-19"]?.entries?.bench?.[0]));
console.log("sample workout 2026-06-06 present:", !!d.workoutLogs["2026-06-06"]);
console.log("weightLogs 2026-06-05:", JSON.stringify(d.weightLogs["2026-06-05"]));
console.log("foodLogs latest day:", Object.keys(d.foodLogs).sort().slice(-1)[0]);
