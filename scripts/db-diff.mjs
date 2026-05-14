// Compare DB state with the JSON file.
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
const json = JSON.parse(
  readFileSync(resolve(here, "..", "gym-tracker-2026-05-14.json"), "utf8")
);
const rows = await sql`SELECT data FROM user_state WHERE user_id = 'sam'`;
if (rows.length === 0) {
  console.log("No user_state row for sam");
  process.exit(0);
}
const db = rows[0].data;

function summarize(s, label) {
  console.log(`=== ${label} ===`);
  console.log("settings keys:", Object.keys(s.settings ?? {}).sort());
  console.log("templates ids:", (s.settings?.templates ?? []).map((t) => t.id));
  console.log("schedule:", s.settings?.schedule);
  console.log("templatesVersion:", s.settings?.templatesVersion);
  console.log("workoutLogs count:", Object.keys(s.workoutLogs ?? {}).length);
  console.log("foodLogs count:", Object.keys(s.foodLogs ?? {}).length);
  console.log("weightLogs count:", Object.keys(s.weightLogs ?? {}).length);
  console.log("customFoods:", (s.settings?.customFoods ?? []).length);
  console.log("recipes:", (s.settings?.recipes ?? []).length);
}
summarize(db, "DB");
summarize(json, "JSON");

// Find which logs the DB is missing
const missingWorkouts = Object.keys(json.workoutLogs).filter(
  (d) => !db.workoutLogs?.[d]
);
const missingFoods = Object.keys(json.foodLogs).filter(
  (d) => !db.foodLogs?.[d]
);
const missingWeights = Object.keys(json.weightLogs).filter(
  (d) => !db.weightLogs?.[d]
);
console.log("\nMissing workouts in DB:", missingWorkouts);
console.log("Missing foods in DB:", missingFoods);
console.log("Missing weights in DB:", missingWeights);

// Sample comparison
console.log("\nSample workout 2026-05-13 in DB:");
console.log(JSON.stringify(db.workoutLogs?.["2026-05-13"], null, 2));
console.log("\nSample workout 2026-05-13 in JSON:");
console.log(JSON.stringify(json.workoutLogs?.["2026-05-13"], null, 2));
