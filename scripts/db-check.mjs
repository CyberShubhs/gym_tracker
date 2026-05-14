// One-off read-only check of the current Neon DB state.
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

const users = await sql`SELECT id, name, passcode_length FROM users ORDER BY created_at`;
console.log("USERS:", JSON.stringify(users, null, 2));

const stateRows = await sql`SELECT user_id, pg_column_size(data) AS bytes FROM user_state ORDER BY user_id`;
console.log("USER_STATE rows:", JSON.stringify(stateRows, null, 2));

for (const r of stateRows) {
  const counts = await sql`
    SELECT
      jsonb_array_length(coalesce(data->'_settings'->'_skip', '[]'::jsonb)) AS dummy,
      (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'workoutLogs', '{}'::jsonb))) AS workouts,
      (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'foodLogs', '{}'::jsonb))) AS foods,
      (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'weightLogs', '{}'::jsonb))) AS weights
    FROM user_state WHERE user_id = ${r.user_id}`;
  console.log(`  ${r.user_id}:`, JSON.stringify(counts[0]));
}
